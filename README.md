# Ponto de Viagem

App para controle de horas em viagens: entrada, saída para almoço, volta e saída final, viagens cadastradas, horários divergentes (inclusive depois da meia-noite), horas a mais sobre o horário comercial e relatórios em PDF.

Esta versão é um app web instalável (PWA):

- Funciona **sem internet** depois de aberto uma vez.
- Os dados ficam **só no celular** (armazenamento do navegador). Use **Perfil → Exportar meus dados** para fazer backup.

## Instalar no Android

1. Abra o endereço do app no **Chrome**.
2. Toque em **Instalar app no celular** (ou menu **⋮ → Instalar app / Adicionar à tela inicial**).
3. O ícone aparece junto dos outros apps e abre em tela cheia.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `index.html` | O app inteiro (telas, regras de cálculo, PDF) |
| `sw.js` | Modo offline. Ao publicar uma atualização, troque `VERSAO` |
| `manifest.webmanifest` | Nome, ícone e cores do app instalado |
| `vendor/` | Bibliotecas do PDF (jsPDF 2.5.1 e jsPDF-AutoTable 3.8.2), guardadas aqui para funcionar offline |
| `icons/` | Ícones do app |

## Regras de cálculo

- Horário comercial padrão: 08:00–11:45 e 13:30–18:00 (jornada de 8h15). Editável em Relatórios.
- Tudo o que for trabalhado fora desse horário conta como hora a mais.
- Saída menor que a entrada = passou da meia-noite (+1 dia).

## Próximo passo

App nativo (Expo / React Native) com APK para Android, reaproveitando estas regras.
