# Sentinel Insight

crie um programa web usando css js e html,

divida em 3 colunas

massiva são 3 sites isolados no mesmo horario (30% da divisao das 3 colunas)

1 coluna onde eu vou colar no lado esquerdo SNMP, e ele vai reconhecer pelo mesmo horario igual, possíveis massivas, ​‌

2 coluna - vai criar uma lista de possiveis massivas ordenadas (mais antiga pra mais recente no topo)​‌

permita o crud dessa lista​‌

e dentro dela permita obs(vou colocar observação dela inteira)​‌

e crie + uma coluna da lista na direita como uma "causa" para por outra obs​‌

e caso tenha algum site que e de outro lado e esta relacionado permita que eu checkbox esse site pra acrescentar​‌

pinte no lado esquerdo por esquema de cores, cada massiva uma cor.​‌

se depois de 1 minuto(ou seja, evento alterar texto) do snmp ao lado esquerdo, mantenha as alterações anteriores como cores, etc, e atualize possiveis futuras massivas, ou seja, tempo real​‌

exemplo:​‌

vai ser colado isso

::IPRAN SNMP

0

h

Roteadores sem resposta SNMP ha mais de 0h:

SI = 115

TOTAL = 115

REGIONAL EQUIPAMENTO ALARME HORARIO

SI SICPRR1-RMP01 SEM_RESP_SNMP 04/10/26 14:27

SI SICPR08-RMA01 SEM_RESP_SNMP 04/10/26 14:27

SI SICASV7-RMP01 SEM_RESP_SNMP 04/10/26 14:27

SI SIPTL02-RMP01 SEM_RESP_SNMP 04/10/26 14:21

SI SISZP14-RMP01 SEM_RESP_SNMP 04/10/26 14:12

SI SIABS05-RMP01 SEM_RESP_SNMP 04/10/26 14:12

SI SI0111F-RMP02 SEM_RESP_SNMP 04/10/26 14:07

SI SIBRU18-RMP01 SEM_RESP_SNMP 04/10/26 14:12

Nesse caso, teríamos 2 massivas

Uma das 14:27

e a segunda 14:12​‌

DEU CERTO!

vamos so ajustar as colunas

1 coluna - diminua um pouco a largura dela

2 coluna - centralize possiveis massivas / causa / correlação

tudo na coluna do meio .

altere por excluir por "ocultar", assim ela nao é contada, mas pode ser "ativa" depois

aqui é a Obs1 (onde é a observação da massiva)

3 coluna - uma lista ordenada resumida

exemplo

QUEDA | QUANTIDADES SITES | CAUSA(Obs2)

13:01 | 20 ESTAÇÕES | XXX

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://massiva-cop-movel.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/473463e6-81e5-4bb8-b268-026ab8efdea2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
