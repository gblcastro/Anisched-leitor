// O Client ID da sua extensão AniSched

const CLIENT_ID = '1040345830968-4hvu86rveeqf54aujtk1q5frt2a4jga2.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

let tokenClient;
let accessToken = null;

const btnLogin = document.getElementById('btnLogin');
const statusBox = document.getElementById('statusBox');
const lblStatus = document.getElementById('lblStatus');
const dataContainer = document.getElementById('dataContainer');
const jsonOutput = document.getElementById('jsonOutput');

// Inicializa a biblioteca do Google Identity
window.onload = async function () {
  await window.I18n.init();
  window.I18n.translatePage();

  const savedToken = localStorage.getItem('googleToken');
  const tokenExp = localStorage.getItem('googleTokenExp');
  
  // Tentar carregar instantaneamente do cache local
  const cachedData = localStorage.getItem('cachedBackupData');
  const cachedTime = localStorage.getItem('cachedBackupTime');
  
  if (cachedData && cachedTime) {
    try {
      const parsedData = JSON.parse(cachedData);
      processarConteudo(parsedData, cachedTime, true);
      
      const badgeSyncStatus = document.getElementById('badgeSyncStatus');
      const syncContainer = document.getElementById('syncStatusContainer');
      badgeSyncStatus.setAttribute('variant', 'warning');
      badgeSyncStatus.innerText = globalThis.I18n.t("webapp_checking_updates") || "Verificando atualizações...";
      syncContainer.style.borderLeftColor = '#ff9800';
      
      window.isCachedLoaded = true;
    } catch (e) {
      console.error("Erro ao ler cache instantâneo:", e);
    }
  }
  
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          accessToken = tokenResponse.access_token;
          
          // Salva o token para não precisar logar a cada F5 (expira em ~1h)
          const expiresIn = tokenResponse.expires_in || 3599;
          localStorage.setItem('googleToken', accessToken);
          localStorage.setItem('googleTokenExp', Date.now() + ((expiresIn - 300) * 1000));
          
          btnLogin.style.display = 'none';
          if (!window.isCachedLoaded) {
            statusBox.style.display = 'block';
            lblStatus.innerText = 'Logado com sucesso. Buscando arquivo de backup no Google Drive...';
          }
          buscarArquivoBackup();
        }
      },
    });
    
    // Se temos um token salvo válido, pula o login manual
    if (savedToken && tokenExp && Date.now() < parseInt(tokenExp)) {
       accessToken = savedToken;
       btnLogin.style.display = 'none';
       if (!window.isCachedLoaded) {
         statusBox.style.display = 'block';
         lblStatus.innerText = 'Sessão restaurada. Buscando arquivo de backup...';
       }
       buscarArquivoBackup();
    }
    
  } catch (err) {
    console.error("Erro ao inicializar GSI", err);
    alert("Erro ao carregar Google Identity Services. Desative adblockers e verifique sua conexão.");
  }
};

btnLogin.addEventListener('click', () => {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    alert("Cliente OAuth não inicializado.");
  }
});

async function buscarArquivoBackup() {
  try {
    const url = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='anisched_backup.json'&fields=files(id,name,modifiedTime)";
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error("Erro na requisição da API: " + response.statusText);
    }

    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
      const fileId = data.files[0].id;
      const driveModifiedTime = data.files[0].modifiedTime;
      const driveDate = new Date(driveModifiedTime);
      
      const cachedDataStr = localStorage.getItem('cachedBackupData');
      const cachedTimeStr = localStorage.getItem('cachedBackupTime');
      
      if (cachedDataStr && cachedTimeStr) {
         const cachedDate = new Date(cachedTimeStr);
         if (driveDate.getTime() <= cachedDate.getTime()) {
             if (!window.isCachedLoaded) {
               lblStatus.innerHTML = `Sincronização verificada!<br>Memória local atualizada em: <strong>${driveDate.toLocaleString()}</strong><br>Carregando...`;
             }
             processarConteudo(JSON.parse(cachedDataStr), driveModifiedTime);
             return;
         }
      }
      
      if (!window.isCachedLoaded) {
        lblStatus.innerHTML = `Atualização encontrada!<br>Sincronizando dados de: <strong>${driveDate.toLocaleString()}</strong><br>Baixando dados...`;
      } else {
        // Se já carregou o cache, o usuário não verá o statusBox, então podemos apenas
        // sinalizar via badge que estamos baixando uma novidade
        const badgeSyncStatus = document.getElementById('badgeSyncStatus');
        badgeSyncStatus.innerText = 'Baixando atualização...';
      }
      
      baixarConteudo(fileId, driveModifiedTime);
    } else {
      if (!window.isCachedLoaded) {
        lblStatus.innerText = "Nenhum arquivo 'anisched_backup.json' encontrado no seu Google Drive (pasta oculta appDataFolder). Você já fez o backup pela extensão do PC?";
      }
    }

  } catch (error) {
    console.error(error);
    lblStatus.innerText = "Erro ao buscar arquivo: " + error.message;
  }
}

async function baixarConteudo(fileId, modifiedTime) {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error("Erro ao baixar conteúdo do arquivo.");
    }

    const jsonData = await response.json();
    
    // Salvar no Cache
    localStorage.setItem('cachedBackupData', JSON.stringify(jsonData));
    localStorage.setItem('cachedBackupTime', modifiedTime);
    
    processarConteudo(jsonData, modifiedTime);

  } catch (error) {
    console.error(error);
    lblStatus.innerText = "Erro ao ler o conteúdo: " + error.message;
  }
}

function processarConteudo(jsonData, modifiedTime) {
  try {
    statusBox.style.display = 'none';
    
    // Configurar o status de sincronização
    const syncContainer = document.getElementById('syncStatusContainer');
    const lblSyncDate = document.getElementById('lblSyncDate');
    const badgeSyncStatus = document.getElementById('badgeSyncStatus');
    
    syncContainer.style.display = 'block';
    
    const modifiedDate = new Date(modifiedTime);
    lblSyncDate.innerText = modifiedDate.toLocaleString();
    
    // Como a verificação com o Google Drive acabou de acontecer, o dado sempre está atualizado com a nuvem
    badgeSyncStatus.setAttribute('variant', 'success');
    badgeSyncStatus.innerText = globalThis.I18n.t("webapp_synced_cloud") || "Atualizado com a Nuvem";
    syncContainer.style.borderLeftColor = '#4CAF50';
    
    // Aplicar Cores Customizadas
    if (jsonData.configuracoesUser) {
      if (jsonData.configuracoesUser.corAgenda1) {
        document.documentElement.style.setProperty('--cor-agenda-1', jsonData.configuracoesUser.corAgenda1);
        document.documentElement.style.setProperty('--text-agenda-1', getContrastYIQ(jsonData.configuracoesUser.corAgenda1));
      }
      if (jsonData.configuracoesUser.corAgenda2) {
          document.documentElement.style.setProperty('--cor-agenda-2', jsonData.configuracoesUser.corAgenda2);
          document.documentElement.style.setProperty('--text-agenda-2', getContrastYIQ(jsonData.configuracoesUser.corAgenda2));
        }
        if (jsonData.configuracoesUser.corAgendaExtra) {
          document.documentElement.style.setProperty('--cor-agenda-cinza', jsonData.configuracoesUser.corAgendaExtra);
          document.documentElement.style.setProperty('--text-agenda-cinza', getContrastYIQ(jsonData.configuracoesUser.corAgendaExtra));
        }
    }
    
    window.__ANISCHED_DATA = jsonData;
    window.__CONFIG_STREAMING = (jsonData.configuracoesUser && jsonData.configuracoesUser.streamingPrefs) 
      ? jsonData.configuracoesUser.streamingPrefs 
      : { hierarquia: ["Crunchyroll", "Netflix", "Amazon Prime Video", "HIDIVE", "Bilibili TV", "Hulu", "Disney Plus", "YouTube", "Abema", "OceanVeil", "OceanVeil (Unedited)"], ignorados: [], manualLinks: {} };
      
    const TODOS_STREAMINGS = ["Crunchyroll", "Netflix", "Amazon Prime Video", "HIDIVE", "Bilibili TV", "Hulu", "Disney Plus", "YouTube", "Abema", "OceanVeil", "OceanVeil (Unedited)"];
    TODOS_STREAMINGS.forEach(s => {
      if (!window.__CONFIG_STREAMING.hierarquia.includes(s) && !window.__CONFIG_STREAMING.ignorados.includes(s)) {
        window.__CONFIG_STREAMING.hierarquia.push(s);
      }
    });
    
    prepararSeletorTemporadas(jsonData);

  } catch (error) {
    console.error(error);
    lblStatus.innerText = "Erro ao ler o conteúdo: " + error.message;
  }
}

const STREAMING_BADGES = {
  "Crunchyroll": { code: "CR", color: "#F47521" },
  "Netflix": { code: "NF", color: "#900000" },
  "Amazon Prime Video": { code: "AM", color: "#00A8E1" },
  "HIDIVE": { code: "HD", color: "#00B0F0" },
  "Bilibili TV": { code: "BL", color: "#00A1D6" },
  "Hulu": { code: "HL", color: "#1CE783" },
  "Disney Plus": { code: "DP", color: "#113CCF" },
  "YouTube": { code: "YT", color: "#FF0000" },
  "Abema": { code: "AB", color: "#33AA22" },
  "OceanVeil": { code: "OV", color: "#00a2a5" },
  "OceanVeil (Unedited)": { code: "OV", color: "#00a2a5" }
};

const ABREV_DIAS = {
  "segunda": "SEG", "terca": "TER", "quarta": "QUA", 
  "quinta": "QUI", "sexta": "SEX", "sabado": "SAB", "domingo": "DOM", "extra": "EXT"
};

function obterMelhorStreaming(anime, configObj) {
  if (!configObj) configObj = { hierarquia: ["Crunchyroll", "Netflix", "Amazon Prime Video", "HIDIVE", "Bilibili TV", "Hulu", "Disney Plus", "YouTube", "Abema", "OceanVeil", "OceanVeil (Unedited)"], ignorados: [], manualLinks: {} };
  
  const animeIdKey = anime.id_anilist ? `ani_${anime.id_anilist}` : `mal_${anime.id_mal}`;
  const linkOverride = configObj.manualLinks[animeIdKey];
  
  if (linkOverride) {
    if (linkOverride.hide) return null;
    if (!configObj.ignorados.includes(linkOverride.site)) {
      if (linkOverride.isManual === false && !configObj.hierarquia.includes(linkOverride.site)) {
        // Ignora se não tá na hierarquia
      } else {
        return { 
          site: linkOverride.site, 
          url: linkOverride.url, 
          isManual: !!linkOverride.isManual,
          badgeCode: linkOverride.badgeCode,
          badgeColor: linkOverride.badgeColor
        };
      }
    }
  }

  // Fallback para ler dados nativos (array de streams ou strings)
  const streamsParaVerificar = anime.streams || (anime.streaming ? anime.streaming.map(s => ({ site: s, url: '' })) : []);

  if (streamsParaVerificar.length > 0) {
    for (let i = 0; i < configObj.hierarquia.length; i++) {
      const prefsSite = configObj.hierarquia[i];
      if (configObj.ignorados.includes(prefsSite)) continue;

      const found = streamsParaVerificar.find(s => s.site === prefsSite);
      if (found) {
        return { site: found.site, url: found.url || '', isManual: false };
      }
    }
  }
  return null;
}

function criarElementoBadgeStreamingHtml(anime) {
  const bestStream = obterMelhorStreaming(anime, window.__CONFIG_STREAMING);
  
  let bgColor = "#555555";
  let textColor = "#cccccc";
  let badgeCode = "NL";
  let tooltipSite = "Não Licenciado";
  let isManual = false;
  let clickActionUrl = "";

  if (bestStream) {
    const configBadge = STREAMING_BADGES[bestStream.site] || { code: bestStream.site.substring(0, 2).toUpperCase(), color: "#444444" };
    bgColor = configBadge.color;
    
    if (bestStream.isManual) {
      if (bestStream.badgeCode) configBadge.code = bestStream.badgeCode;
      if (bestStream.badgeColor) bgColor = bestStream.badgeColor;
      isManual = true;
    }
    
    textColor = getContrastYIQ(bgColor);
    badgeCode = configBadge.code;
    tooltipSite = (globalThis.I18n.t("tooltip_watch_on") || "Assistir no {0}").replace("{0}", bestStream.site) + (isManual ? (globalThis.I18n.t("tooltip_manual_stream") || " (Personalizado/Manual)") : "");
    clickActionUrl = bestStream.url;
  }

  let borderStyle = isManual ? `border: 1px dashed ${textColor === '#fff' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)'}; box-sizing: border-box;` : '';
  const hrefAttr = clickActionUrl ? `href="${clickActionUrl}" target="_blank"` : `href="#" onclick="return false;"`;

  return `
    <a ${hrefAttr} title="${tooltipSite}" class="badge-agenda" style="display: flex; align-items: stretch; border-radius: 4px; overflow: hidden; height: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); text-decoration: none;">
      <div style="background-color: ${bgColor}; color: ${textColor}; font-size: 12px; font-weight: bold; width: 32px; display: flex; align-items: center; justify-content: center; ${borderStyle}">${badgeCode}</div>
    </a>
  `;
}

function getContrastYIQ(hexcolor){
  if (!hexcolor) return 'white';
  hexcolor = hexcolor.replace("#", "");
  if (hexcolor.length === 3) {
    hexcolor = hexcolor.split('').map(c => c + c).join('');
  }
  const r = parseInt(hexcolor.substr(0,2),16);
  const g = parseInt(hexcolor.substr(2,2),16);
  const b = parseInt(hexcolor.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? '#111' : '#fff';
}

function capitalizar(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getNomeAmigavelTemporada(key) {
  if (!key) return "Desconhecida";
  const map = {
    "spring": "Primavera",
    "summer": "Verão",
    "fall": "Outono",
    "winter": "Inverno"
  };
  const parts = key.split('_');
  if (parts.length === 2) {
    return `${map[parts[0]] || capitalizar(parts[0])} ${parts[1]}`;
  }
  return key;
}

function prepararSeletorTemporadas(dados) {
  const selectorContainer = document.getElementById('seasonSelectorContainer');
  const btnAbrirGaveta = document.getElementById('btnAbrirGavetaTemporada');
  const gaveta = document.getElementById('gavetaTemporada');
  const drawerContent = document.getElementById('containerBotoesTemporada');
  const container = document.getElementById('scheduleContainer');
  const boardContainer = document.getElementById('boardContainer');
  
  // Configurar botão de fechar
  
  
  if (!dados || !dados.cronogramaSemanal) {
    container.style.display = 'block';
    if(boardContainer) boardContainer.style.display = 'block';
    container.innerHTML = '<p>Nenhum dado de cronograma encontrado no backup.</p>';
    return;
  }
  
  const temporadasDisponiveis = Object.keys(dados.cronogramaSemanal);
  
  if (temporadasDisponiveis.length === 0) {
    container.style.display = 'block';
    if(boardContainer) boardContainer.style.display = 'block';
    container.innerHTML = '<p>Você não agendou nenhum anime em nenhuma temporada ainda.</p>';
    return;
  }
  
  // Ordenar temporadas (mais recentes primeiro)
  temporadasDisponiveis.sort((a, b) => {
    const [seasonA, yearA] = a.split('_');
    const [seasonB, yearB] = b.split('_');
    if (yearA !== yearB) return parseInt(yearB) - parseInt(yearA);
    const ordemMeses = { "winter": 1, "spring": 2, "summer": 3, "fall": 4 };
    return ordemMeses[seasonA.toLowerCase()] - ordemMeses[seasonB.toLowerCase()];
  });
  
  // Decidir a temporada inicial
  let temporadaInicial = dados.temporadaAtiva;
  if (!temporadaInicial || !temporadasDisponiveis.includes(temporadaInicial)) {
    temporadaInicial = temporadasDisponiveis[0];
  }
  
  // Agrupar por ano
  const agrupadoPorAno = {};
  temporadasDisponiveis.forEach(idTemporada => {
    const [season, year] = idTemporada.split('_');
    if (!agrupadoPorAno[year]) agrupadoPorAno[year] = [];
    agrupadoPorAno[year].push({ id: idTemporada, season: capitalizar(season), year });
  });
  
  function renderizarDrawer(tempAtivaId) {
    drawerContent.innerHTML = '';
    Object.keys(agrupadoPorAno).sort((a,b) => parseInt(b) - parseInt(a)).forEach(ano => {
      const anoGroup = document.createElement("div");
      anoGroup.style.marginBottom = "20px";
      
      const anoTitle = document.createElement("div");
      anoTitle.style.fontWeight = "bold";
      anoTitle.style.fontSize = "18px";
      anoTitle.style.color = "#aaa";
      anoTitle.style.borderBottom = "1px solid #ccc";
      anoTitle.style.paddingBottom = "5px";
      anoTitle.style.marginBottom = "10px";
      anoTitle.innerText = ano;
      anoGroup.appendChild(anoTitle);

      agrupadoPorAno[ano].forEach(temp => {
        const btn = document.createElement("sl-button");
        btn.className = "btn-gaveta-temporada";
        const sLower = temp.season.toLowerCase();
        
        let varianteCor = "primary";
        if (sLower === "spring") varianteCor = "success";
        if (sLower === "summer") varianteCor = "warning";
        if (sLower === "fall") varianteCor = "danger";

        if (temp.id === tempAtivaId) {
          btn.setAttribute("variant", varianteCor);
        } else {
          btn.setAttribute("variant", "neutral");
          btn.setAttribute("outline", "");
        }
        btn.style.marginRight = "8px";
        btn.style.marginBottom = "8px";
        btn.style.width = "45%";
        
        let icone = "";
        let mes = "";
        if(sLower === "spring") { icone = "🌸 "; mes = globalThis.I18n.t("month_apr") || "Abril"; }
        if(sLower === "winter") { icone = "❄️ "; mes = globalThis.I18n.t("month_jan") || "Janeiro"; }
        if(sLower === "summer") { icone = "☀️ "; mes = globalThis.I18n.t("month_jul") || "Julho"; }
        if(sLower === "fall") { icone = "🍂 "; mes = globalThis.I18n.t("month_oct") || "Outubro"; }

        let badgeVariant = varianteCor;
        if (temp.id === tempAtivaId) {
          badgeVariant = "neutral";
        }

        btn.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; width: 100%; align-items: center;">
            <div style="text-align: center; display: flex; justify-content: center; align-items: center;">
              ${icone}${temp.season}
            </div>
            <div style="display: flex; justify-content: center; align-items: center;">
              <span slot="suffix">
                <sl-badge variant="${badgeVariant}" style="font-size: 10px; width: 65px; display: flex; justify-content: center; --sl-badge-padding: 0;">${mes}</sl-badge>
              </span>
            </div>
          </div>
        `;
        
        btn.addEventListener("click", () => {
          gaveta.hide();
          renderizarDrawer(temp.id); // Reconstrói o drawer com as cores certas
          
          // Atualiza o botão principal
          const [sA, yA] = temp.id.split('_');
          btnAbrirGaveta.innerHTML = `<sl-icon slot="prefix" name="calendar3"></sl-icon> ${capitalizar(sA)} ${yA} <span slot="suffix" style="display: flex; align-items: center; margin-left: 8px;"><sl-badge variant="neutral" style="font-size: 10px;">${mes}</sl-badge></span>`;
          btnAbrirGaveta.setAttribute("variant", varianteCor);
          
          // Renderiza a tabela
          renderizarCronogramaDaTemporada(temp.id, dados);
        });
        
        anoGroup.appendChild(btn);
      });
      
      drawerContent.appendChild(anoGroup);
    });
  }
  
  // Renderizar a primeira vez a gaveta
  renderizarDrawer(temporadaInicial);
  
  // Atualizar visual do botão principal
  const [sA, yA] = temporadaInicial.split('_');
  const sLowerAtiva = sA.toLowerCase();
  let mesMain = "";
  if(sLowerAtiva === "spring") mesMain = globalThis.I18n.t("month_apr") || "Abril";
  if(sLowerAtiva === "winter") mesMain = globalThis.I18n.t("month_jan") || "Janeiro";
  if(sLowerAtiva === "summer") mesMain = globalThis.I18n.t("month_jul") || "Julho";
  if(sLowerAtiva === "fall") mesMain = globalThis.I18n.t("month_oct") || "Outubro";
  
  btnAbrirGaveta.innerHTML = `<sl-icon slot="prefix" name="calendar3"></sl-icon> ${capitalizar(sA)} ${yA} <span slot="suffix" style="display: flex; align-items: center; margin-left: 8px;"><sl-badge variant="neutral" style="font-size: 10px;">${mesMain}</sl-badge></span>`;
  
  let varCorGeral = "primary";
  if (sLowerAtiva === "spring") varCorGeral = "success";
  if (sLowerAtiva === "summer") varCorGeral = "warning";
  if (sLowerAtiva === "fall") varCorGeral = "danger";
  btnAbrirGaveta.setAttribute("variant", varCorGeral);
  
  if (!btnAbrirGaveta.dataset.listener) {
    btnAbrirGaveta.addEventListener('click', () => gaveta.show());
    btnAbrirGaveta.dataset.listener = "true";
  }
  
  selectorContainer.style.display = 'block';
  if(boardContainer) boardContainer.style.display = 'block';
  
  // Renderizar a primeira vez
  renderizarCronogramaDaTemporada(temporadaInicial, dados);
}

function renderizarCronogramaDaTemporada(temporada, dados) {
  const container = document.getElementById('scheduleContainer');
  container.innerHTML = '';
  container.style.display = 'block';
  const boardContainer = document.getElementById('boardContainer');
  if(boardContainer) boardContainer.style.display = 'block';
  const cronogramaTemporada = dados.cronogramaSemanal[temporada] || {};
  const dicionarioAnimes = dados.mapaDeIds || {};
  
  const DIAS_SEMANA = [
    { id: 'segunda', nome: globalThis.I18n.t('day_mon_full') || 'Segunda-Feira', cor: 'bg-azul' },
    { id: 'terca', nome: globalThis.I18n.t('day_tue_full') || 'Terça-Feira', cor: 'bg-verde' },
    { id: 'quarta', nome: globalThis.I18n.t('day_wed_full') || 'Quarta-Feira', cor: 'bg-azul' },
    { id: 'quinta', nome: globalThis.I18n.t('day_thu_full') || 'Quinta-Feira', cor: 'bg-verde' },
    { id: 'sexta', nome: globalThis.I18n.t('day_fri_full') || 'Sexta-Feira', cor: 'bg-azul' },
    { id: 'sabado', nome: globalThis.I18n.t('day_sat_full') || 'Sábado', cor: 'bg-verde' },
    { id: 'domingo', nome: globalThis.I18n.t('day_sun_full') || 'Domingo', cor: 'bg-azul' },
      { id: 'extra', nome: globalThis.I18n.t('day_ext_full') || 'Sem dia fixo', cor: 'bg-cinza' }
  ];
  
  let animesEncontrados = false;
  
  const arrayRanking = Array.isArray(dados.rankingPorTemporada?.[temporada]) ? dados.rankingPorTemporada[temporada] : [];
  const notasPessoais = dados.notasPessoais || {};

  DIAS_SEMANA.forEach(dia => {
    const listaAnimes = cronogramaTemporada[dia.id];
    if (!listaAnimes || listaAnimes.length === 0) return; // Oculta dias sem animes
    
    animesEncontrados = true;
    
    const linha = document.createElement("div");
    linha.className = "linha-dia";
      if (dia.id === "extra") {
        linha.style.marginTop = "24px";
        linha.style.backgroundColor = "var(--cor-agenda-cinza, #313338)";
        linha.style.borderTop = "1px solid rgba(0,0,0,0.4)";
      }

    const celulaDia = document.createElement("div");
    celulaDia.className = `celula-dia ${dia.cor}`;
    celulaDia.innerText = dia.nome;
    linha.appendChild(celulaDia);

    const containerSlots = document.createElement("div");
    containerSlots.className = `container-slots ${dia.cor}`;
    
    listaAnimes.forEach(animeObj => {
      const detalhesExtra = (animeObj.id_anilist && dicionarioAnimes[`ani_${animeObj.id_anilist}`]) ? dicionarioAnimes[`ani_${animeObj.id_anilist}`] : {};
      const anime = { ...animeObj, ...detalhesExtra };
      const titulo = anime.titulo || anime.titulo_romaji || anime.titulo_english || "Sem Título";
      
      let colorStyle = "inherit";
      let isToggled = "false";
      let aId = String(anime.id_anilist || anime.id_mal || 0);
      try {
        const destacados = JSON.parse(localStorage.getItem("animesDestacados") || "[]");
        if (destacados.includes(aId) || destacados.includes(Number(aId))) {
           colorStyle = "#8a0303";
           isToggled = "true";
        }
      } catch(e) {}
      
      const slot = document.createElement("div");
      
      // Lado Esquerdo: Badge de Horário/Dia + Título
      let horaHtml = "";
      if (anime.dia_transmissao || anime.hora_estreia) {
        let textoBadge = anime.dia_transmissao ? (ABREV_DIAS[anime.dia_transmissao] || anime.dia_transmissao) : anime.hora_estreia;
        
        // Se está no mesmo dia, exibe a hora. Caso contrário, exibe o dia em que ele vai ao ar oficialmente (ex: SEG)
        if (dia.id === anime.dia_transmissao && anime.hora_estreia) {
          textoBadge = anime.hora_estreia;
        }
        
        horaHtml = `
          <span class="badge-agenda badge-agenda-wrapper" style="display: inline-flex; margin-right: 8px;">
            <sl-badge class="badge-dia" variant="neutral" style="cursor:pointer;" onclick="window.toggleAnimeColor(this, '${aId}')">${textoBadge}</sl-badge>
          </span>
        `;
      }
      
      let esquerdoHtml = `
        <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
          ${horaHtml}
          <span data-toggled="${isToggled}" style="font-weight: bold; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${colorStyle};" title="${titulo}">
            ${titulo}
          </span>
        </div>
      `;
      
      // Lado Direito: Links MAL/AniList + Badge Streaming
      let botoesHtml = "";
      let estiloAtalho = "display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; background-color: rgba(0,0,0,0.15); box-sizing: border-box;";
      
      if (anime.id_mal) {
        botoesHtml += `
          <a href="https://myanimelist.net/anime/${anime.id_mal}" target="_blank" title="${(globalThis.I18n.t('tooltip_open_with') || 'Abrir {0}').replace('{0}', 'MAL')}" class="badge-agenda" style="${estiloAtalho}">
            <img src="https://myanimelist.net/favicon.ico" width="14" height="14" style="display:block; border-radius:2px;">
          </a>
        `;
      }
      if (anime.id_anilist) {
        botoesHtml += `
          <a href="https://anilist.co/anime/${anime.id_anilist}" target="_blank" title="${(globalThis.I18n.t('tooltip_open_with') || 'Abrir {0}').replace('{0}', 'AniList')}" class="badge-agenda" style="${estiloAtalho}">
            <img src="https://anilist.co/img/icons/favicon-32x32.png" width="14" height="14" style="display:block; border-radius:2px;">
          </a>
        `;
      }
      if (botoesHtml !== "") {
         botoesHtml = `<div style="display: inline-flex; align-items: center; gap: 6px; margin-right: 4px; flex-shrink: 0;">${botoesHtml}</div>`;
      }
      
      let badgeHtml = criarElementoBadgeStreamingHtml(anime);
      
      let direitoHtml = `<div style="display: flex; align-items: center; gap: 8px;">${botoesHtml}${badgeHtml}</div>`;
      
      const idChave = anime.id_anilist ? `ani_${anime.id_anilist}` : `mal_${anime.id_mal}`;
      const indexRank = Array.isArray(arrayRanking) ? arrayRanking.indexOf(idChave) : -1;
      const rankNum = indexRank >= 0 ? indexRank + 1 : "-";
      const notaScore = notasPessoais[idChave] || "--";
      
      slot.className = "slot-anime";
      
      slot.innerHTML = esquerdoHtml + direitoHtml;
      
      // Impede que o clique nos links (MAL/AniChart/Streaming) gire o card
      setTimeout(() => {
        const links = slot.querySelectorAll('a');
        links.forEach(a => {
          a.addEventListener('click', (e) => {
            e.stopPropagation();
          });
        });
      }, 0);
      
      containerSlots.appendChild(slot);
    });
    
    linha.appendChild(containerSlots);
    container.appendChild(linha);
  });
  
  if (!animesEncontrados) {
    container.innerHTML = '<p>Você não agendou nenhum anime para esta temporada.</p>';
  }
  
  if (typeof renderizarRankingDaTemporada === 'function') {
    renderizarRankingDaTemporada(temporada, dados);
  }
  
  if (typeof renderizarListaEstreias === 'function') {
    renderizarListaEstreias(temporada, dados);
  }
}

function renderizarRankingDaTemporada(temporada, dados) {
  const rankingContainer = document.getElementById('rankingContainer');
  if (!rankingContainer) return;
  rankingContainer.innerHTML = '';
  
  const arrayRanking = Array.isArray(dados.rankingPorTemporada?.[temporada]) ? dados.rankingPorTemporada[temporada] : [];
  const notasPessoais = dados.notasPessoais || {};
  
  // Reconstruir o dicionário de animes a partir do cronograma para ter acesso ao título e notas
  const dicionarioAnimes = {};
  if (dados.cronogramaSemanal && dados.cronogramaSemanal[temporada]) {
    Object.values(dados.cronogramaSemanal[temporada]).forEach(listaDia => {
      if (Array.isArray(listaDia)) {
        listaDia.forEach(anime => {
          const idChave = anime.id_anilist ? `ani_${anime.id_anilist}` : `mal_${anime.id_mal}`;
          dicionarioAnimes[idChave] = anime;
        });
      }
    });
  }
  
  if (arrayRanking.length === 0) {
    rankingContainer.innerHTML = '<p style="text-align: center; color: #888; font-style: italic; margin-top: 20px;">Nenhum ranking definido para esta temporada.</p>';
    return;
  }
  
  const arrayRankingOriginal = [...arrayRanking];
  arrayRanking.sort((idA, idB) => {
    const notaA = notasPessoais[idA] !== undefined && notasPessoais[idA] !== "" ? parseFloat(notasPessoais[idA]) : -1;
    const notaB = notasPessoais[idB] !== undefined && notasPessoais[idB] !== "" ? parseFloat(notasPessoais[idB]) : -1;
    
    if (notaA !== notaB) {
      return notaB - notaA; // Maior nota fica no topo
    }
    return arrayRankingOriginal.indexOf(idA) - arrayRankingOriginal.indexOf(idB);
  });
  
  arrayRanking.forEach((idChave, index) => {
    const anime = dicionarioAnimes[idChave];
    if (!anime) return;
    
    const rankNum = index + 1;
    const notaSua = notasPessoais[idChave] || '--';
    
    const rankSlot = document.createElement("div");
    rankSlot.style.display = "flex";
    rankSlot.style.alignItems = "center";
    rankSlot.style.justifyContent = "space-between";
    rankSlot.style.padding = "10px 14px";
    rankSlot.style.border = "1px solid rgba(255, 255, 255, 0.05)";
    rankSlot.style.borderRadius = "6px";
    
    let rankBg = "rgba(0, 0, 0, 0.25)";
    if (notaSua !== '--') {
      const notaNum = parseFloat(notaSua);
      if (notaNum >= 9) rankBg = "linear-gradient(90deg, rgba(0, 50, 0, 0.7) 0%, rgba(0, 0, 0, 0.25) 100%)";
      else if (notaNum >= 8) rankBg = "linear-gradient(90deg, rgba(30, 70, 30, 0.7) 0%, rgba(0, 0, 0, 0.25) 100%)";
      else if (notaNum >= 7) rankBg = "linear-gradient(90deg, rgba(80, 70, 0, 0.7) 0%, rgba(0, 0, 0, 0.25) 100%)";
      else if (notaNum >= 6) rankBg = "linear-gradient(90deg, rgba(90, 45, 0, 0.7) 0%, rgba(0, 0, 0, 0.25) 100%)";
      else rankBg = "linear-gradient(90deg, rgba(70, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.25) 100%)";
    }
    rankSlot.style.background = rankBg;
    
    let iconCor = "#888";
    if (rankNum === 1) iconCor = "#ffd700";
    else if (rankNum === 2) iconCor = "#c0c0c0";
    else if (rankNum === 3) iconCor = "#cd7f32";
    
    const notaAL = anime.score_anilist ? anime.score_anilist + "%" : "N/A";
    const notaMAL = anime.score_mal ? Number(anime.score_mal).toFixed(2) : "N/A";
    
    const estiloBadgeBase = "display: inline-flex; align-items: center; justify-content: center; padding: 2px 5px; border-radius: 4px; font-size: 11px; font-weight: bold; gap: 4px; min-width: 42px; font-variant-numeric: tabular-nums;";
    
    const badgeMAL = `
      <a href="${anime.id_mal ? 'https://myanimelist.net/anime/' + anime.id_mal : '#'}" target="_blank" style="${estiloBadgeBase} background-color: #2e51a2; color: #fff; border: 1px solid #1c336b; text-decoration: none; cursor: pointer;" title="${(globalThis.I18n.t('tooltip_open_with') || 'Abrir {0}').replace('{0}', 'MyAnimeList')}">
        <img src="https://myanimelist.net/favicon.ico" width="12" height="12" style="border-radius: 2px;">
        ${notaMAL}
      </a>
    `;
    
    const badgeAL = `
      <a href="${anime.id_anilist ? 'https://anilist.co/anime/' + anime.id_anilist : '#'}" target="_blank" style="${estiloBadgeBase} background-color: #1a1a24; color: #fff; border: 1px solid #333; text-decoration: none; cursor: pointer;" title="${(globalThis.I18n.t('tooltip_open_with') || 'Abrir {0}').replace('{0}', 'AniList')}">
        <img src="https://anilist.co/img/icons/favicon-32x32.png" width="12" height="12" style="border-radius: 2px;">
        ${notaAL}
      </a>
    `;
    
    const badgeNota = `
      <div style="${estiloBadgeBase} background-color: rgba(255, 193, 7, 0.15); color: #ffc107; border: 1px solid rgba(255,193,7,0.3); min-width: 35px;" title="Sua Nota">
        <sl-icon name="star-fill"></sl-icon> ${notaSua}
      </div>
    `;
    
    rankSlot.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; padding-right: 10px;">
        <span style="font-weight: 900; font-size: 18px; min-width: 28px; text-align: center; color: ${iconCor};">#${rankNum}</span>
        <span style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #e8e8e8;" title="${anime.titulo}">${anime.titulo}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <div class="ranking-external-scores" style="display: flex; gap: 6px;">
          ${badgeMAL}
          ${badgeAL}
        </div>
        ${badgeNota}
      </div>
    `;
    
    rankingContainer.appendChild(rankSlot);
  });
}


// Lógica para o botão de ocultar notas no mobile
document.addEventListener('DOMContentLoaded', () => {
  const btnToggleScores = document.getElementById('btnToggleRankingScoresMobile');
  if (btnToggleScores) {
    let scoresHidden = false;
    btnToggleScores.addEventListener('click', () => {
      scoresHidden = !scoresHidden;
      btnToggleScores.name = scoresHidden ? 'eye-slash' : 'eye';
      btnToggleScores.style.color = scoresHidden ? '#555' : '#a4b1cd';
      
      const rankingContainer = document.getElementById('rankingContainer');
      if (rankingContainer) {
        if (scoresHidden) {
          rankingContainer.classList.add('hide-external');
        } else {
          rankingContainer.classList.remove('hide-external');
        }
      }
    });
  }
});

window.toggleAnimeColor = function(el, animeId) {
  let destacados = [];
  try {
    destacados = JSON.parse(localStorage.getItem("animesDestacados") || "[]");
  } catch(e) {}
  
  const spanTitulo = el.parentElement.nextElementSibling;
  
  if (spanTitulo.dataset.toggled === 'true') {
    spanTitulo.style.color = 'inherit';
    spanTitulo.dataset.toggled = 'false';
    destacados = destacados.filter(id => id !== animeId);
  } else {
    spanTitulo.style.color = '#8a0303';
    spanTitulo.dataset.toggled = 'true';
    if (!destacados.includes(animeId)) destacados.push(animeId);
  }
  
  localStorage.setItem("animesDestacados", JSON.stringify(destacados));
};

function renderizarListaEstreias(temporada, dados) {
  const container = document.getElementById('premiereContainer');
  if (!container) return;
  container.innerHTML = '';
  
  if (!dados.cronogramaSemanal || !dados.cronogramaSemanal[temporada]) return;
  
  const todosAnimes = [];
  Object.values(dados.cronogramaSemanal[temporada]).forEach(listaDia => {
    if (Array.isArray(listaDia)) {
      listaDia.forEach(anime => {
        if (anime.data_estreia && !anime.isManual) {
          todosAnimes.push(anime);
        }
      });
    }
  });
  
  if (todosAnimes.length === 0) return;
  
  // Sort
  todosAnimes.sort((a, b) => {
    const parseDate = (dateStr) => {
      if (!dateStr) return 0;
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      return 0;
    };
    const tA = parseDate(a.data_estreia);
    const tB = parseDate(b.data_estreia);
    if (tA !== tB) return tA - tB;
    
    // Sort by time if date is the same
    const parseTime = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      if (parts.length >= 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
      return 0;
    };
    return parseTime(a.hora_estreia) - parseTime(b.hora_estreia);
  });
  
  const tituloSecao = document.createElement('h2');
  tituloSecao.innerText = "🗓️ " + (globalThis.I18n.t("webapp_premiere") || "Próximas Estreias");
  tituloSecao.style.textAlign = 'center';
  tituloSecao.style.marginTop = '25px';
  tituloSecao.style.marginBottom = '20px';
  tituloSecao.style.fontSize = '22px';
  tituloSecao.style.fontWeight = 'bold';
  tituloSecao.style.color = 'var(--sl-color-neutral-900)';
  container.appendChild(tituloSecao);
  
  const lista = document.createElement('div');
  lista.style.display = 'grid';
  lista.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
  lista.style.gap = '15px';
  
  // Group by date
  const agrupados = {};
  todosAnimes.forEach(anime => {
    const dataText = anime.data_estreia.substring(0, 5);
    if (!agrupados[dataText]) agrupados[dataText] = [];
    agrupados[dataText].push(anime);
  });
  
  const today = new Date();
  const todayStr = String(today.getDate()).padStart(2, '0') + '/' + String(today.getMonth() + 1).padStart(2, '0');
  
  Object.keys(agrupados).forEach(data => {
    const groupDiv = document.createElement('div');
    groupDiv.style.display = 'flex';
    groupDiv.style.flexDirection = 'column';
    groupDiv.style.borderRadius = '10px';
    groupDiv.style.overflow = 'hidden';
    groupDiv.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    groupDiv.style.border = '1px solid rgba(255,255,255,0.05)';
    groupDiv.style.backgroundColor = 'rgba(0,0,0,0.2)';
    
    const header = document.createElement('div');
    if (data === todayStr) {
      header.style.backgroundColor = '#e53e3e'; // Different color for today
      header.style.color = '#fff';
      header.innerHTML = `<sl-icon name="calendar-date"></sl-icon> ${(globalThis.I18n.t("webapp_today") || "{0} (Hoje)").replace("{0}", data)}`;
    } else {
      header.style.backgroundColor = 'var(--cor-agenda-1, #4c6ef5)';
      header.style.color = 'var(--text-agenda-1, #fff)';
      header.innerHTML = `<sl-icon name="calendar-event"></sl-icon> ${data}`;
    }
    header.style.padding = '10px 15px';
    header.style.fontWeight = 'bold';
    header.style.fontSize = '16px';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';
    groupDiv.appendChild(header);
    
    const itemsContainer = document.createElement('div');
    itemsContainer.style.padding = '10px';
    itemsContainer.style.display = 'flex';
    itemsContainer.style.flexDirection = 'column';
    itemsContainer.style.gap = '8px';
    
    agrupados[data].forEach(anime => {
      const horaText = anime.hora_estreia ? `${anime.hora_estreia}` : '--:--';
      const nome = anime.titulo || anime.titulo_romaji || anime.titulo_english || "Sem Título";
      
      let colorStyle = "inherit";
      let isToggled = "false";
      let aId = String(anime.id_anilist || anime.id_mal || 0);
      try {
        const destacados = JSON.parse(localStorage.getItem("estreiasDestacadas") || "[]");
        if (destacados.includes(aId) || destacados.includes(Number(aId))) {
           colorStyle = "#8a0303";
           isToggled = "true";
        }
      } catch(e) {}
      
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '10px';
      item.style.padding = '8px 12px';
      item.style.backgroundColor = 'var(--sl-color-neutral-0)';
      item.style.borderRadius = '6px';
      item.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
      item.style.cursor = 'default';
      
      item.onmouseenter = () => {
        item.style.transform = 'translateY(-2px)';
        item.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
      };
      item.onmouseleave = () => {
        item.style.transform = 'none';
        item.style.boxShadow = 'none';
      };
      
      item.innerHTML = `
        <span style="font-weight: bold; color: var(--cor-agenda-1, #4c6ef5); min-width: 45px; font-size: 14px; cursor: pointer;" onclick="window.togglePremiereColor(this, '${aId}')">${horaText}</span>
        <span data-toggled="${isToggled}" style="flex: 1; font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${colorStyle};" title="${nome}">
          ${nome}
        </span>
      `;
      itemsContainer.appendChild(item);
    });
    
    groupDiv.appendChild(itemsContainer);
    lista.appendChild(groupDiv);
  });
  
  container.appendChild(lista);
}

window.togglePremiereColor = function(el, animeId) {
  let destacados = [];
  try {
    destacados = JSON.parse(localStorage.getItem("estreiasDestacadas") || "[]");
  } catch(e) {}
  
  const spanTitulo = el.nextElementSibling;
  
  if (spanTitulo.dataset.toggled === 'true') {
    spanTitulo.style.color = 'inherit';
    spanTitulo.dataset.toggled = 'false';
    destacados = destacados.filter(id => id !== animeId);
  } else {
    spanTitulo.style.color = '#8a0303';
    spanTitulo.dataset.toggled = 'true';
    if (!destacados.includes(animeId)) destacados.push(animeId);
  }
  
  localStorage.setItem("estreiasDestacadas", JSON.stringify(destacados));
};
