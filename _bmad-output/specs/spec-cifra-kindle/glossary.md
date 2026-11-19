# Glossário — Adaptador de Cifras para Kindle

- **Cifra** — Letra de uma música com os acordes indicados sobre a sílaba onde devem ser tocados. Fonte: Cifra Club.
- **Tom** — A tonalidade musical em que os acordes de uma cifra estão escritos; transpor significa recalcular os acordes para outro Tom mantendo a relação harmônica.
- **Cifra Club** — Site de origem das cifras buscadas por este projeto (cifraclub.com.br).
- **Kindle** — Dispositivo de leitura de destino dos arquivos gerados por este projeto.
- **Send-to-Kindle** — Mecanismo oficial da Amazon para enviar arquivos ao Kindle por e-mail (endereço `@kindle.com`) ou upload manual. Este projeto automatiza a via e-mail/SMTP.
- **Approved Sender** — Endereço de e-mail cadastrado na conta Amazon do usuário como autorizado a enviar arquivos via Send-to-Kindle (limite de até 15 endereços). Configuração manual única, pré-requisito de CAP-4 (ver Constraints C-11).
- **Arquivo pronto** — O arquivo final gerado pelo projeto: um EPUB reflowable contendo a Cifra buscada já transposta nos 12 tons cromáticos, navegável por links internos entre as versões, abrindo no Tom original. Pronto para envio via Send-to-Kindle sem edição adicional.
- **Capotraste** — Casa do braço onde o capo prende as cordas. Quando existe, o conteúdo da cifra traz os acordes da **forma** (como a mão toca), e não do tom que soa. O app expõe a casa como `capotraste`.
- **Tom que soa vs. forma** — Tom que soa é a tonalidade real ouvida (rótulo de cada versão no app, ex.: `F#m`); forma é o desenho dos acordes tocados com o capo (ex.: `Em` com capo na 2ª casa). Sem capotraste os dois coincidem.
