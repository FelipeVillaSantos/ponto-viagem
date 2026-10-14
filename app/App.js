import { useEffect, useRef, useCallback } from "react";
import { BackHandler, Platform, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import * as Notifications from "expo-notifications";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import WEBAPP from "./webapp";

// Endereço fixo da página dentro do app. NÃO MUDE: os dados salvos ficam ligados a ele.
const ORIGEM = "https://ponto-viagem.app/";
const CANAL = "lembretes";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Batidas do dia e o horário (do horário comercial) usado para lembrar cada uma
const BATIDAS = [
  { chave: "in1", hora: "a1", antes: true, titulo: "Hora de bater a entrada", texto: "Registre a entrada no Ponto de Viagem." },
  { chave: "out1", hora: "a2", antes: false, titulo: "Saída para o almoço", texto: "Registre a saída para o almoço." },
  { chave: "in2", hora: "b1", antes: true, titulo: "Volta do almoço", texto: "Registre a volta do almoço." },
  { chave: "out2", hora: "b2", antes: false, titulo: "Fim do expediente", texto: "Registre a saída final." },
];

const pad = (n) => String(n).padStart(2, "0");
const chaveDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function prepararCanal() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: "Lembretes de ponto",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
  }
}

async function permitido(pedir) {
  let st = await Notifications.getPermissionsAsync();
  if (!st.granted && pedir && st.canAskAgain !== false) st = await Notifications.requestPermissionsAsync();
  return !!st.granted;
}

// Reagenda os lembretes dos próximos 7 dias, pulando batidas já registradas, fins de semana e folgas
async function reagendar(estado) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const L = estado?.lembretes;
  if (!L?.on || !estado.horario) return;
  if (!(await permitido(false))) return;
  const agora = new Date();
  for (let i = 0; i < 7; i++) {
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i);
    const semana = dia.getDay();
    if (semana === 0 || semana === 6) continue;
    const reg = estado.dias?.[chaveDia(dia)] || {};
    if (reg.folga) continue;
    for (const b of BATIDAS) {
      if (reg[b.chave]) continue;
      const [h, m] = String(estado.horario[b.hora] || "").split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) continue;
      const antes = b.antes ? Number(L.antes) || 0 : 0;
      const quando = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m - antes);
      const avisos = [{ data: quando, titulo: b.titulo, texto: b.antes && antes ? `${b.texto} Começa às ${pad(h)}:${pad(m)}.` : b.texto }];
      if (L.repetir) avisos.push({ data: new Date(quando.getTime() + (antes + 15) * 60000), titulo: "Você ainda não registrou", texto: b.texto });
      for (const a of avisos) {
        if (a.data <= agora) continue;
        await Notifications.scheduleNotificationAsync({
          content: { title: a.titulo, body: a.texto, data: { abrir: "ponto" }, sound: "default" },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.data, channelId: CANAL },
        });
      }
    }
  }
}

function Tela() {
  const web = useRef(null);
  const ultimoEstado = useRef("");
  const pronto = useRef(false);
  const escuro = useColorScheme() === "dark";

  const rodar = useCallback((js) => web.current?.injectJavaScript(`try{${js}}catch(e){};true;`), []);

  useEffect(() => {
    prepararCanal();
    const toque = Notifications.addNotificationResponseReceivedListener(() => rodar("window.__goPonto&&window.__goPonto()"));
    const voltar = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!pronto.current) return false;
      rodar("window.__nativeBack&&window.__nativeBack()");
      return true;
    });
    return () => { toque.remove(); voltar.remove(); };
  }, [rodar]);

  const aoCarregar = useCallback(() => {
    pronto.current = true;
    // aberto tocando numa notificação: vai direto para a aba Ponto
    Promise.resolve(Notifications.getLastNotificationResponse?.())
      .then((ultima) => {
        if (!ultima) return;
        setTimeout(() => rodar("window.__goPonto&&window.__goPonto()"), 800);
        Promise.resolve(Notifications.clearLastNotificationResponse?.()).catch(() => {});
      })
      .catch(() => {});
  }, [rodar]);

  const aoReceber = useCallback(async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.nativeEvent.data); } catch { return; }
    try {
      if (msg.type === "state") {
        const s = JSON.stringify(msg);
        if (s !== ultimoEstado.current) { ultimoEstado.current = s; await reagendar(msg); }
      } else if (msg.type === "permissao") {
        await prepararCanal();
        const ok = await permitido(true);
        rodar(`window.__nativePerm&&window.__nativePerm(${ok})`);
        if (ok && ultimoEstado.current) await reagendar(JSON.parse(ultimoEstado.current));
      } else if (msg.type === "teste") {
        await prepararCanal();
        if (await permitido(true)) {
          await Notifications.scheduleNotificationAsync({
            content: { title: "Ponto de Viagem", body: "Os lembretes estão funcionando.", sound: "default" },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CANAL },
          });
        } else rodar("window.__nativePerm&&window.__nativePerm(false)");
      } else if (msg.type === "arquivo") {
        const nome = String(msg.nome || "arquivo").replace(/[^\w.\-]+/g, "-");
        const arq = new File(Paths.cache, nome);
        arq.create({ overwrite: true });
        arq.write(msg.b64, { encoding: "base64" });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(arq.uri, { mimeType: msg.mime, dialogTitle: nome });
      } else if (msg.type === "copiar") {
        await Clipboard.setStringAsync(String(msg.texto || ""));
      } else if (msg.type === "sair") {
        BackHandler.exitApp();
      }
    } catch (e) {
      rodar(`typeof toast==="function"&&toast(${JSON.stringify("Não foi possível concluir: " + (e?.message || e))})`);
    }
  }, [rodar]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: escuro ? "#0d1322" : "#f3f5fa" }} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style={escuro ? "light" : "dark"} />
      <WebView
        ref={web}
        source={{ html: WEBAPP, baseUrl: ORIGEM }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        setSupportMultipleWindows={false}
        overScrollMode="never"
        textZoom={100}
        onMessage={aoReceber}
        onLoadEnd={aoCarregar}
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Tela />
    </SafeAreaProvider>
  );
}
