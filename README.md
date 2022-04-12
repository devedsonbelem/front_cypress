# cypress-api


Teste Etapas da arquitetura

Os produtores e o barramento de dados se comunicam via API REST. Como mencionamos anteriormente, o barramento de dados deve aceitar muitas mensagens por segundo. Portanto, tivemos que garantir o tratamento mais rápido possível da solicitação e a persistência da mensagem. O resto do trabalho – propagar mensagens para os receptores – pode ser feito de forma assíncrona. Nossa melhor aposta foi RabbitMQ . Após persistir as mensagens, o sistema publica informações sobre elas no message broker.

Prova de conceito concluída – tempo para alguns testes de arquitetura
Com a primeira versão do nosso barramento de dados finalizada, é hora de pensar em testá-lo. Afinal, foi por isso que o criamos! 

Estávamos imaginando como poderíamos modelar muitos produtores enviando mensagens. Nosso chefe de QA veio em socorro e nos mostrou a ferramenta K6 e suas possibilidades. Se você quiser aprender mais sobre isso, ele escreveu um artigo abrangente sobre o framework K6.

Em resumo, ele permite escrever um script simples em JavaScript para criar usuários virtuais que fazem solicitações HTTP para fins de modelagem. E isso é exatamente o que estávamos procurando.

Primeira etapa de teste de arquitetura no dev
Arquitetura dos primeiros testes
Realizamos alguns tipos de testes de desempenho:

Testes de resistência – esse era o nosso foco principal. Você pode realizar testes de resistência ao testar o comportamento do aplicativo com uma carga esperada por um longo período de tempo.
Teste de estresse – é usado para verificar os pontos críticos de quebra de nossa aplicação. Ele fornece a resposta de quão grande pode ser a carga até que nosso sistema pare de funcionar efetivamente.
Teste de carga – para verificar os gargalos em nossa arquitetura e aplicação. Os componentes de arquitetura de nossos sistemas são monitorados quando realizamos testes de carga.
Inicialmente, queríamos investigar a carga máxima que o barramento de dados pode aceitar. Então, escrevemos um script K6 simples que seleciona uma mensagem aleatória do conjunto preparado e a envia para o barramento de dados. Vale ressaltar também que nossos primeiros testes foram realizados em uma máquina mais ou menos quatro vezes pior que o ambiente alvo.  

Você pode perguntar, por quê? Acho que melhorar sua arquitetura em uma máquina mais fraca pode ser uma abordagem lucrativa. Ele ajuda você a encontrar mais coisas que estão reduzindo o desempenho, pois você tem menos recursos de computação.

Primeiro resultado
Nossos primeiros resultados não foram satisfatórios. Atingimos o resultado de ± 450 solicitações por segundo . Como não foi tão ruim (para uma máquina mais fraca), outra estatística nos preocupou. Descobriu-se que cerca de 5% das solicitações terminavam com erros internos do servidor. O culpado acabou por ser os recursos do servidor. Precisávamos reduzir a carga de teste para encontrar um ponto crítico sem erros internos do servidor. E assim fizemos. Esse ponto estava próximo de ± 280 solicitações por segundo . Foi quase quatro vezes menor que a carga mínima exigida! 

Eu sei o que você está pensando agora. “Você tem uma máquina quatro vezes mais lenta e quatro vezes menos carga mínima necessária. Então, depois de mover a solução para o ambiente de destino – os resultados serão acima de 1.000 solicitações por segundo!”. Infelizmente, não é tão simples: o desempenho não aumenta linearmente com o aumento dos recursos de computação. 

Começamos a procurar uma explicação para esse problema de desempenho em muitos níveis. Após algumas pesquisas, tivemos alguns suspeitos. Começamos a verificá-los um por um. Este foi um processo essencial necessário para descartar falsas suposições.

Suspeito número um - um código de aplicativo
Prosseguimos para verificar nosso código. O tempo médio de solicitação durante o primeiro teste de carga foi de 170 ms. Isso é bastante para um endpoint que está apenas aceitando a mensagem e persistindo-a.

testando arquitetura de software meme

Começamos a analisar uma única solicitação usando o criador de perfil Xdebug. Depois disso, visualizamos os resultados usando PHPStorm. Esses dois combinados podem ser uma ferramenta poderosa para criar perfis de solicitações, além da depuração interativa. Você pode conferir como fazer aqui . Resumindo – você pode explorar os caminhos de execução de todas as funções chamadas na solicitação e ver quanto tempo cada etapa levou.

phpstorm
Visualização de instantâneo do XDebug Profiler no PHPStorm
Com base nisso, chegamos a algumas conclusões interessantes e descobrimos as causas de uma solicitação mais lenta:

Symfony Messenger – é uma ferramenta poderosa que usa barramentos para enviar mensagens e manipulá-las. No entanto, inicialmente o usamos no barramento de dados apenas para uma abordagem CQRS limpa. Descobriu-se que a execução de um comando via manipulador tem uma grande árvore de chamadas que leva um tempo significativo em nossa solicitação. Nós o removemos e começamos a invocar manipuladores em uma forma de chamada de serviço.
SensioFrameworkExtraBundle – no nosso caso, usamos para o recurso ParamConverter – para converter a solicitação bruta em algum objeto. Não previmos que este pacote estava usando seus ouvintes em todas as ações do controlador. O XDebug Profiler Snapshot mostrou que não precisávamos de quase nenhum deles, exceto o relacionado ao ParamConverter. Remover este pacote e substituí-lo por nosso conversor personalizado aumentou o tempo de execução de nossas solicitações.
Serializador JMS – usado para (des)serializar dados. Ele suporta os formatos XML e JSON. Durante nossos testes, descobrimos que ele é um pouco mais lento que o Symfony. Também ficou muito mais claro escrever normalizadores personalizados para o segundo (tivemos que fazê-lo por causa da estrutura complexa da mensagem).
Escrever soluções personalizadas para manipulação de comandos, conversão de solicitações e (des)serialização de dados funcionou bem. Reduzimos o tempo de execução do pedido do protótipo em mais de 80% ! Após executar os testes de desempenho novamente, nosso tempo médio de solicitação ficou em torno de 30 ms . Fizemos testes de estresse novamente para encontrar uma carga máxima que o barramento de dados pode aceitar sem erros internos do servidor. E aumentou para ± 450 solicitações por segundo. O resultado foi cerca de 60% melhor do que antes das alterações de código!

Como você pode ver, existem algumas situações em que vale a pena substituir ferramentas populares e úteis por coisas personalizadas. Na maioria dos casos, você não notará nenhuma diferença. No entanto, isso realmente importa quando se trata do desempenho durante uma carga de uma grande quantidade de solicitações.

Suspeita número dois – conexões entre componentes
Nosso próximo suspeito estava relacionado às operações do banco de dados e do agente de mensagens. Queríamos verificar se isso estava causando problemas de desempenho. Para isso, escolhemos uma ferramenta de monitoramento do sistema chamada Prometheus. Começamos a coletar tempos de operações de banco de dados e publicações de mensagens em nosso aplicativo durante o teste de carga. Também criamos um endpoint de API para buscar esses horários. Em seguida, integramos com o Grafana para visualizar os resultados de forma contínua.

Durante o teste de carga com o Grafana, as métricas de “solicitações por segundo” foram muito piores, mas esperávamos isso. Foi devido à coleta de dados adicionais pelo Prometheus. Isso não nos incomodou, pois queríamos apenas verificar o tempo médio de operação dos componentes que o barramento de dados estava utilizando.

Captura de tela do painel do Grafana
Painel Grafana com resultados. Os tempos mín./máx./méd. são expressos em segundos.
Como você pode ver no painel acima – a conexão entre os componentes não era o problema. Nós o removemos da lista de suspeitos. 

Aliás, se você quiser saber mais sobre o Prometheus e coletar métricas, confira este artigo sobre testes de métricas do Grafana e do Prometheus escrito por meus colegas.

Suspeito número três – componentes do sistema
Após melhorias no código e verificação dos tempos de conexão entre os componentes, chegou a hora de monitorar os recursos do servidor. Suspeitamos que sob carga pesada, o aplicativo PHP pode estar competindo com outros componentes do sistema por recursos do servidor. Vale acrescentar que outro requisito da aplicação, além de trabalhar em uma máquina dedicada, foi a conteinerização do barramento de dados e seus demais componentes. Usamos o Docker para isso. 

Reunimos as estatísticas de uso de recursos com um script personalizado usando um comando de estatísticas do Docker . Ele salvaria os resultados a cada 15 segundos em um arquivo. Depois disso, transformamos os dados e criamos gráficos de linha separados para uso de RAM e CPU. 

Não encontramos nada de interesse no gráfico de RAM. No entanto, o segundo diagrama de uso da CPU chamou nossa atenção. Lembre-se de que na ferramenta de monitoramento do Docker, a utilidade máxima de um thread da CPU é 100%. Por isso os dados apresentam valores acima de 100% no gráfico abaixo. 

Teste de carga com captura de tela do MariaDB
Carregue testes com MariaDB como banco de dados. O eixo X representa o número da amostra e o eixo Y representa a utilização da CPU (em %).
Bingo! Parecia que estávamos certos porque o PHP lutou por recursos com o banco de dados. 

Nossa primeira abordagem foi começar a ajustar o banco de dados. Pesquisamos quais deveriam ser as melhores configurações para o mais alto desempenho. Infelizmente, algumas tentativas de alterações na configuração do banco de dados não trouxeram os resultados esperados. Talvez tivesse funcionado em outras máquinas – mas em nosso ambiente dockerizado, não estava ajudando.

Tentamos uma solução NoSQL e usamos o Mongo E os resultados foram muito melhores do que com bancos de dados relacionais. Atingimos um resultado de ± 1400 solicitações por segundo! No entanto, após os primeiros testes, abandonamos esta solução. Foi devido à exigência de durabilidade dos dados do cliente.

Decidimos experimentar um mecanismo de banco de dados de relação diferente – pensamos que talvez o utilitário de recursos mudasse em comparação com o PostgreSQL. Apostamos no MariaDB e começamos a buscar o ponto crítico da nossa aplicação.

Nossos primeiros resultados com um mecanismo de banco de dados substituído foram um grande choque para nós. A carga máxima que o barramento de dados pode suportar aumentou de ± 450 solicitações por segundo para estável ± 700 solicitações por segundo! E isso foi na configuração de banco de dados quase padrão. Acabamos de aumentar o número permitido de conexões simultâneas.

Carregar captura de tela do MariaDB do teste
Carregue testes com MariaDB como banco de dados. O eixo X representa o número da amostra e o eixo Y representa a utilização da CPU (em %).
Executamos nossos testes de carga e ferramenta de monitoramento para verificar a utilidade de recursos com um novo mecanismo de banco de dados. Descobriu-se que o MariaDB usa menos CPU e é mais ganancioso por RAM. Não foi um problema, pois tínhamos muita RAM sobressalente em nossos ambientes. Tentamos manipular a configuração do MariaDB esperando um desempenho ainda melhor, mas isso não funcionou para o nosso caso.

Tempo para mover a solução para o ambiente de destino.
Depois de melhorar o desempenho do nosso aplicativo, passamos para o ambiente de teste dedicado e executamos os testes. E quase tivemos um ataque cardíaco. Cerca de 50% dos pedidos terminaram com falha! Começamos a procurar uma causa para isso. Demoramos um pouco, mas encontramos. 

O problema estava nos parâmetros do kernel no contêiner docker do PHP. O intervalo de portas era muito pequeno e não havia conexões paralelas máximas permitidas suficientes. Adicionamos uma seção sysctls em nosso arquivo docker-compose e executamos os testes novamente.

php:
  image: 
    ...
  env_file:
    ...
  volumes:
    ...
  sysctls:
    net.ipv4.ip_local_port_range: "1500 65000"
    net.core.somaxconn: 10000
    net.ipv4.tcp_tw_reuse: 1
view rawdata_bus_docker_compose.yaml hosted with ❤ by GitHub
Os resultados foram muito satisfatórios. Conseguimos uma estabilidade de ~ 1.500 solicitações por segundo em uma carga de teste de resistência de 20 minutos , o que é 50% acima do mínimo exigido! Melhorar o desempenho do aplicativo em uma máquina muito mais fraca valeu a pena.

Nas próximas etapas, desenvolvemos o aplicativo com novas funcionalidades. Também adicionamos o envio de mensagens do barramento de dados à nossa arquitetura de teste. Implantamos um aplicativo simples em Node.js, que imitava os receptores aceitando mensagens. Executamos nossos testes de desempenho após cada recurso, o que pode afetar o desempenho do aplicativo. No final, depois de desenvolver todos os recursos principais, nosso desempenho diminuiu um pouco para ± 1.430 solicitações por segundo. Esse resultado também foi satisfatório.


Arquitetura de teste final
 

Conclusões
Atingimos nosso objetivo e atendemos o requisito de desempenho especificado pelo cliente. Como você pode ver, há muitas maneiras de melhorar o desempenho do seu aplicativo:

Use o criador de perfil para pesquisar quaisquer gargalos do seu aplicativo. 
Verifique as bibliotecas/pacotes que você tem em seu projeto. Certifique-se de que você precisa de todos eles. 
Verifique a arquitetura e os componentes que você usa. Talvez existam substitutos mais eficientes. 
Teste as conexões entre os componentes do seu aplicativo.
Execute testes de desempenho regularmente. Às vezes, uma alteração discreta em seu código pode ter um grande impacto no desempenho. 
O problema pode estar no nível do código, no nível da conexão e até mesmo nos componentes do aplicativo incompatíveis. Lembre-se de escolher as ferramentas certas para o problema. E que existem muitas maneiras e ferramentas de suporte para testar o desempenho também.

Palavras finais: O que este projeto nos ensinou?
Em primeiro lugar, uma cooperação muito estreita entre a equipe de desenvolvimento e o controle de qualidade. Nós dois tivemos a chance de conhecer mais sobre nossa perspectiva de trabalho. Me convenci de que um QA especializado em testes manuais é a pessoa perfeita para testar arquitetura porque tem uma abordagem muito diferente dos programadores, mas requer paciência e abertura de ambos os lados (programador e testador). Graças aos testes de arquitetura, os especialistas de controle de qualidade podem encontrar possíveis bugs e lacunas antes mesmo que a primeira linha de código apareça. 

Trabalhar com um protótipo foi algo novo para nós dois, mas acho que concordamos que é muito conveniente ter tempo e espaço para verificar se as ideias funcionam como esperamos em um ambiente isolado, antes de criarmos milhões de linhas de código. 

O desempenho pode ser muito complicado, e é bom verificá-lo de vez em quando, mesmo que o cliente não o exija diretamente - isso economizará tempo a longo prazo e você não terá surpresas terríveis no final do o projeto. 

Graças à excelente cooperação da equipe (lembre-se que desenvolvedores e testadores estão sempre jogando para a mesma equipe), fomos capazes de atender aos requisitos do cliente mais uma vez! 

Rodada de bônus: uma recapitulação das ferramentas que usamos para testes de arquitetura



K6 - ferramenta de teste de carga

Xdebug profiler – ferramenta para encontrar gargalos em seu script 

  Grafana – Dashboard operacional

Docker – plataforma de conteinerização 

Prometheus – uma ferramenta de monitoramento de código aberto

 