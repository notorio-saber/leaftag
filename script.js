// ===== SYNC STORAGE INTEGRADO (SEM MÓDULOS ES6) =====
const SyncStorage = {
  config: {
    localStorageKey: 'leaftag_inventarios',
    debounceTime: 1000,
    userId: null
  },

  state: {
    saving: false,
    saveTimeout: null
  },

  init() {
    console.log('🌱 LeafTag SyncStorage: Inicializando...');
    this.config.userId = this.generateUserId();
    this.loadData();
    console.log('✅ LeafTag SyncStorage: Módulo inicializado com sucesso');
    return true;
  },

  generateUserId() {
    const stored = localStorage.getItem('leaftag_user_id');
    if (stored) return stored;
    
    const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('leaftag_user_id', newId);
    return newId;
  },

  save(inventarios) {
    if (this.state.saving) {
      this.scheduleDelayedSave(inventarios);
      return;
    }

    try {
      this.state.saving = true;
      this.saveToLocal(inventarios);
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
    } finally {
      this.state.saving = false;
    }
  },

  saveToLocal(inventarios) {
    try {
      const data = {
        inventarios: inventarios || [],
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      
      localStorage.setItem(this.config.localStorageKey, JSON.stringify(data));
      console.log(`💾 Dados salvos localmente (${inventarios?.length || 0} inventários)`);
      
    } catch (error) {
      console.error('❌ Erro localStorage:', error);
    }
  },

  loadData() {
    try {
      const data = this.loadFromLocal();
      
      if (data && data.inventarios) {
        window.inventarios = data.inventarios;
        console.log(`📋 ${data.inventarios.length} inventários carregados`);
        
        if (typeof window.carregarInventarios === 'function') {
          setTimeout(() => window.carregarInventarios(), 100);
        }
      }
      
      return data;
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      return null;
    }
  },

  loadFromLocal() {
    try {
      const stored = localStorage.getItem(this.config.localStorageKey);
      if (!stored) return null;
      
      const data = JSON.parse(stored);
      console.log('💾 Dados carregados do localStorage');
      return data;
      
    } catch (error) {
      console.error('❌ Erro ao carregar localStorage:', error);
      localStorage.removeItem(this.config.localStorageKey);
      return null;
    }
  },

  scheduleDelayedSave(inventarios) {
    if (this.state.saveTimeout) {
      clearTimeout(this.state.saveTimeout);
    }
    
    this.state.saveTimeout = setTimeout(() => {
      this.save(inventarios);
    }, this.config.debounceTime);
  },

  manualSave() {
    return this.save(window.inventarios);
  }
};

// ===== CÓDIGO ORIGINAL DO LEAFTAG =====

// Variáveis globais
let inventarios = [];
let currentInventory = null;
let currentIndividualIndex = 1;
let inventoryColumns = [];
let inventoryData = [];
let currentCoordinates = null;
let editingIndividualIndex = -1;
let originalIndividualData = null;
let currentStems = [];

// Templates padrão
const templates = {
  basico: {
    nome: 'Básico',
    colunas: ['nomePopular', 'cap', 'dap']
  },
  completo: {
    nome: 'Completo',
    colunas: ['nomePopular', 'nomeCientifico', 'familia', 'cap', 'dap', 'hc', 'ht', 'coordenadas', 'observacoes']
  },
  rapido: {
    nome: 'Rápido',
    colunas: ['nomePopular', 'cap', 'observacoes']
  }
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  console.log('LeafTag Inventário iniciado com sucesso!');
  
  // Inicializar sync storage
  SyncStorage.init();
  
  // Event listener para mudança no tipo de export
  document.addEventListener('change', function(e) {
    if (e.target && e.target.name === 'exportPackage') {
      toggleCustomCalculations(e.target.value === 'customizado');
    }
  });
});

// Navegação entre telas
function goTo(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => screen.classList.remove('active'));
  
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
    
    if (screenId === 'inventoryScreen') {
      carregarInventarios();
    }
  }
}

function calcularAreaParcela() {
  const largura = parseFloat(document.getElementById('plotWidth').value);
  const comprimento = parseFloat(document.getElementById('plotLength').value);
  
  if (largura && comprimento) {
    const area = largura * comprimento;
    document.getElementById('plotArea').value = area.toFixed(2);
    showFeedback(`Área calculada: ${area.toFixed(2)} m²`);
  } else {
    alert('Por favor, preencha largura e comprimento.');
  }
}

// Funções GPS
function obterCoordenadas() {
  const button = event.target;
  
  if (!navigator.geolocation) {
    showGPSError('GPS não suportado neste dispositivo');
    return;
  }

  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> Obtendo GPS...';

  const options = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 10000
  };

  navigator.geolocation.getCurrentPosition(
    function(position) {
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toLocaleString('pt-BR')
      };

      currentCoordinates = coords;
      
      const coordField = document.getElementById('field_coordenadas') || document.getElementById('edit_field_coordenadas');
      if (coordField) {
        coordField.value = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
      }

      showGPSSuccess(coords);
      
      button.disabled = false;
      button.innerHTML = '✓ GPS Obtido';
      button.style.backgroundColor = '#28a745';
      
      setTimeout(function() {
        button.innerHTML = '📍 Obter GPS';
        button.style.backgroundColor = '#007bff';
      }, 3000);
    },
    function(error) {
      let errorMessage = 'Erro ao obter localização';
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permissão de localização negada';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Localização indisponível';
          break;
        case error.TIMEOUT:
          errorMessage = 'Tempo limite excedido';
          break;
      }
      
      showGPSError(errorMessage);
      
      button.disabled = false;
      button.innerHTML = '❌ Erro GPS';
      button.style.backgroundColor = '#dc3545';
      
      setTimeout(function() {
        button.innerHTML = '📍 Obter GPS';
        button.style.backgroundColor = '#007bff';
      }, 3000);
    },
    options
  );
}

function showGPSSuccess(coords) {
  const existingDisplay = document.querySelector('.coordinates-display');
  if (existingDisplay) {
    existingDisplay.remove();
  }

  const display = document.createElement('div');
  display.className = 'coordinates-display';
  display.innerHTML = `
    <div class="coordinates-text">
      📍 Lat: ${coords.latitude.toFixed(6)}<br>
      📍 Lon: ${coords.longitude.toFixed(6)}
    </div>
    <div class="coordinates-accuracy">
      🎯 Precisão: ±${coords.accuracy.toFixed(0)}m<br>
      🕒 ${coords.timestamp}
    </div>
  `;

  const gpsButton = document.querySelector('.btn-gps');
  if (gpsButton && gpsButton.parentNode) {
    gpsButton.parentNode.insertBefore(display, gpsButton.nextSibling);
  }
}

function showGPSError(message) {
  const existingDisplay = document.querySelector('.coordinates-display');
  if (existingDisplay) {
    existingDisplay.remove();
  }

  const display = document.createElement('div');
  display.className = 'coordinates-display error';
  display.innerHTML = `
    <div class="coordinates-text">
      ❌ ${message}
    </div>
    <div class="coordinates-accuracy">
      Verifique as permissões de localização
    </div>
  `;

  const gpsButton = document.querySelector('.btn-gps');
  if (gpsButton && gpsButton.parentNode) {
    gpsButton.parentNode.insertBefore(display, gpsButton.nextSibling);
  }

  setTimeout(function() {
    if (display.parentNode) {
      display.parentNode.removeChild(display);
    }
  }, 5000);
}

// Gerenciamento de inventários
function carregarInventarios() {
  const container = document.getElementById('inventoryList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (inventarios.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <h3>Nenhum inventário encontrado</h3>
        <p>Inicie sua primeira coleta de dados!</p>
      </div>
    `;
    return;
  }
  
  inventarios.forEach(function(inventario, index) {
    const card = document.createElement('div');
    card.className = 'inventory-card';
    card.onclick = function() { abrirInventario(index); };
    
    const totalIndividuos = inventario.dados ? inventario.dados.length : 0;
    const dataUltimaColeta = inventario.ultimaColeta || inventario.dataInicio;
    const status = totalIndividuos === 0 ? 'Novo' : 'Em andamento';
    const areaInfo = inventario.areaParcela ? `📐 ${inventario.areaParcela}m²` : '';
    
    card.innerHTML = `
      <div class="inventory-card-title">${inventario.nome}</div>
      <div class="inventory-card-info">📍 ${inventario.local}</div>
      ${areaInfo ? `<div class="inventory-card-info">${areaInfo}</div>` : ''}
      <div class="inventory-card-info">📅 Criado: ${inventario.dataInicio}</div>
      <div class="inventory-card-info">🕒 Última coleta: ${dataUltimaColeta}</div>
      <div class="inventory-card-info">📊 Status: ${status}</div>
      <div class="inventory-card-stats">
        <div class="inventory-stat">
          <div class="inventory-stat-number">${totalIndividuos}</div>
          <div class="inventory-stat-label">Indivíduos</div>
        </div>
        <div class="inventory-stat">
          <div class="inventory-stat-number">${inventario.colunas ? inventario.colunas.length : 0}</div>
          <div class="inventory-stat-label">Colunas</div>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// Templates
function carregarTemplate(templateId) {
  const template = templates[templateId];
  if (!template) return;
  
  goTo('inventorySetupScreen');
  document.getElementById('templateSelect').value = templateId;
  aplicarTemplate();
}

function aplicarTemplate() {
  const templateId = document.getElementById('templateSelect').value;
  if (!templateId || !templates[templateId]) return;
  
  const template = templates[templateId];
  
  const checkboxes = document.querySelectorAll('#columnOptions input[type="checkbox"]');
  checkboxes.forEach(function(cb) { cb.checked = false; });
  
  template.colunas.forEach(function(coluna) {
    const checkbox = document.querySelector(`input[value="${coluna}"]`);
    if (checkbox) checkbox.checked = true;
  });
}

// Configuração do inventário
function novoInventario() {
  limparFormularioInventario();
  goTo('inventorySetupScreen');
}

function limparFormularioInventario() {
  const campos = ['inventoryName', 'inventoryLocation', 'plotArea', 'plotWidth', 'plotLength', 'templateSelect'];
  campos.forEach(function(id) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.value = '';
  });
  
  const checkboxes = document.querySelectorAll('#columnOptions input[type="checkbox"]');
  checkboxes.forEach(function(cb) { cb.checked = false; });
  
  const nomePopularCheckbox = document.querySelector('input[value="nomePopular"]');
  if (nomePopularCheckbox) nomePopularCheckbox.checked = true;
  
  const customColumns = document.getElementById('customColumns');
  if (customColumns) customColumns.innerHTML = '';
}

function adicionarColunaPersonalizada() {
  const container = document.getElementById('customColumns');
  if (!container) return;
  
  const div = document.createElement('div');
  div.className = 'custom-column-input';
  
  div.innerHTML = `
    <input type="text" placeholder="Nome da coluna" class="custom-column-name">
    <button type="button" onclick="removerColunaPersonalizada(this)">✕</button>
  `;
  
  container.appendChild(div);
}

function removerColunaPersonalizada(button) {
  button.parentElement.remove();
}

function getColumnType(columnId) {
  const types = {
    'nomePopular': 'text',
    'nomeCientifico': 'text',
    'familia': 'text',
    'cap': 'number',
    'dap': 'number',
    'hc': 'number',
    'ht': 'number',
    'coordenadas': 'text',
    'observacoes': 'textarea'
  };
  return types[columnId] || 'text';
}

function iniciarInventario() {
  const nome = document.getElementById('inventoryName').value.trim();
  const local = document.getElementById('inventoryLocation').value.trim();
  const areaParcela = parseFloat(document.getElementById('plotArea').value);
  
  if (!nome) {
    alert('Por favor, digite um nome para o inventário.');
    return;
  }
  
  if (!local) {
    alert('Por favor, digite o local do inventário.');
    return;
  }
  
  if (!areaParcela || areaParcela <= 0) {
    alert('Por favor, informe a área da parcela em m².');
    return;
  }
  
  const checkboxes = document.querySelectorAll('#columnOptions input[type="checkbox"]:checked');
  const colunasBasicas = Array.from(checkboxes).map(function(cb) {
    return {
      id: cb.value,
      nome: cb.parentElement.textContent.trim(),
      tipo: getColumnType(cb.value)
    };
  });
  
  const customInputs = document.querySelectorAll('.custom-column-name');
  const colunasPersonalizadas = Array.from(customInputs)
    .filter(function(input) { return input.value.trim(); })
    .map(function(input, index) {
      return {
        id: `custom_${Date.now()}_${index}`,
        nome: input.value.trim(),
        tipo: 'text'
      };
    });
  
  const todasColunas = colunasBasicas.concat(colunasPersonalizadas);
  
  if (todasColunas.length === 0) {
    alert('Por favor, selecione pelo menos uma coluna para coleta.');
    return;
  }
  
  currentInventory = {
    id: Date.now(),
    nome: nome,
    local: local,
    areaParcela: areaParcela,
    fatorExpansao: 10000 / areaParcela,
    dataInicio: new Date().toLocaleDateString('pt-BR'),
    ultimaColeta: new Date().toLocaleDateString('pt-BR'),
    colunas: todasColunas,
    dados: [],
    template: document.getElementById('templateSelect').value || 'customizado'
  };
  
  inventoryColumns = todasColunas;
  inventoryData = [];
  currentIndividualIndex = 1;
  
  prepararTelaColeta();
  goTo('inventoryCollectionScreen');
}

// Coleta de dados
function prepararTelaColeta() {
  document.getElementById('inventoryTitle').textContent = currentInventory.nome;
  document.getElementById('currentIndividual').textContent = `Indivíduo ${currentIndividualIndex}`;
  
  const container = document.getElementById('dataCollectionCards');
  container.innerHTML = '';
  
  currentCoordinates = null;
  
  // Reset múltiplos fustes
  const multipleStemsCheckbox = document.getElementById('multipleStems');
  if (multipleStemsCheckbox) {
    multipleStemsCheckbox.checked = false;
  }
  
  const stemsContainer = document.getElementById('stemsContainer');
  if (stemsContainer) {
    stemsContainer.style.display = 'none';
  }
  
  currentStems = [];
  
  inventoryColumns.forEach(function(coluna, index) {
    const card = document.createElement('div');
    card.className = 'data-collection-card';
    
    const inputType = coluna.tipo === 'number' ? 'number' : 'text';
    const inputElement = coluna.tipo === 'textarea' ? 'textarea' : 'input';
    const stepAttr = coluna.tipo === 'number' ? 'step="0.1"' : '';
    const autoFocus = index === 0 ? 'autofocus' : '';
    
    if (coluna.id === 'coordenadas') {
      card.innerHTML = `
        <h3>${coluna.nome}</h3>
        <input 
          type="text" 
          ${autoFocus}
          id="field_${coluna.id}" 
          placeholder="Latitude, Longitude"
          readonly
          onkeydown="handleKeyDown(event, '${coluna.id}')"
        />
        <button type="button" class="btn-gps" onclick="obterCoordenadas()">
          📍 Obter GPS
        </button>
      `;
    } else {
      card.innerHTML = `
        <h3>${coluna.nome}</h3>
        <${inputElement} 
          type="${inputType}" 
          ${stepAttr} 
          ${autoFocus}
          id="field_${coluna.id}" 
          placeholder="Digite ${coluna.nome.toLowerCase()}"
          onkeydown="handleKeyDown(event, '${coluna.id}')"
        ></${inputElement}>
      `;
    }
    
    container.appendChild(card);
  });
}

function handleKeyDown(event, currentFieldId) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    
    const currentIndex = inventoryColumns.findIndex(function(col) { 
      return col.id === currentFieldId; 
    });
    
    if (currentIndex < inventoryColumns.length - 1) {
      const nextFieldId = inventoryColumns[currentIndex + 1].id;
      const nextField = document.getElementById(`field_${nextFieldId}`);
      if (nextField && nextField.parentElement.style.display !== 'none') {
        nextField.focus();
      }
    } else {
      salvarIndividuo();
    }
  }
}

// Múltiplos Fustes
function toggleMultipleStems() {
  const multipleStemsCheckbox = document.getElementById('multipleStems');
  const container = document.getElementById('stemsContainer');
  
  if (!multipleStemsCheckbox || !container) return;
  
  const isChecked = multipleStemsCheckbox.checked;
  
  if (isChecked) {
    container.style.display = 'block';
    
    // Esconde campos CAP e altura dos cards principais
    ['field_cap', 'field_hc', 'field_ht'].forEach(function(id) {
      const field = document.getElementById(id);
      if (field) {
        field.parentElement.style.display = 'none';
      }
    });
    
    // Adiciona primeiro fuste se não existir
    if (currentStems.length === 0) {
      adicionarFuste();
    } else {
      renderStems();
    }
  } else {
    container.style.display = 'none';
    currentStems = [];
    
    // Mostra campos CAP e altura dos cards principais
    ['field_cap', 'field_hc', 'field_ht'].forEach(function(id) {
      const field = document.getElementById(id);
      if (field) {
        field.parentElement.style.display = 'block';
      }
    });
  }
}

function adicionarFuste() {
  const stemId = `stem_${Date.now()}_${Math.random()}`;
  currentStems.push({
    id: stemId,
    cap: '',
    altura: ''
  });
  renderStems();
}

function removerFuste(stemId) {
  currentStems = currentStems.filter(function(stem) { return stem.id !== stemId; });
  
  // Se não sobrou nenhum fuste, adiciona um
  if (currentStems.length === 0) {
    adicionarFuste();
  } else {
    renderStems();
  }
}

function renderStems() {
  const container = document.getElementById('stemsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (currentStems.length === 0) return;
  
  currentStems.forEach(function(stem, index) {
    const card = document.createElement('div');
    card.className = 'stem-card';
    
    const removeButton = currentStems.length > 1 ? 
      `<button type="button" class="remove-stem-btn" onclick="removerFuste('${stem.id}')">✕</button>` : 
      '<div style="width: 40px;"></div>';
    
    card.innerHTML = `
      <h4>Fuste ${index + 1}</h4>
      <div class="stem-inputs">
        <input 
          type="number" 
          step="0.1" 
          placeholder="CAP (cm)" 
          value="${stem.cap || ''}"
          oninput="updateStem('${stem.id}', 'cap', this.value)"
        />
        <input 
          type="number" 
          step="0.1" 
          placeholder="Altura (m)" 
          value="${stem.altura || ''}"
          oninput="updateStem('${stem.id}', 'altura', this.value)"
        />
        ${removeButton}
      </div>
    `;
    
    container.appendChild(card);
  });
}

function updateStem(stemId, field, value) {
  const stem = currentStems.find(function(s) { return s.id === stemId; });
  if (stem) {
    stem[field] = value;
  }
}

function salvarIndividuo() {
  const dadosIndividuo = { 
    numeroIndividuo: currentIndividualIndex,
    timestamp: new Date().toLocaleString('pt-BR')
  };
  
  const multipleStemsCheckbox = document.getElementById('multipleStems');
  const isMultipleStems = multipleStemsCheckbox ? multipleStemsCheckbox.checked : false;
  
  dadosIndividuo.multipleStems = isMultipleStems;
  let temDados = false;
  
  // Coleta dados de todos os campos
  inventoryColumns.forEach(function(coluna) {
    const field = document.getElementById(`field_${coluna.id}`);
    if (field && field.parentElement.style.display !== 'none') {
      const valor = field.value.trim();
      dadosIndividuo[coluna.id] = valor;
      if (valor) temDados = true;
    }
  });

  if (currentCoordinates) {
    dadosIndividuo.coordenadas_detalhadas = currentCoordinates;
  }
  
  // Se múltiplos fustes
  if (isMultipleStems) {
    if (currentStems.length === 0) {
      alert('Por favor, adicione pelo menos um fuste.');
      return;
    }
    
    const fustesValidos = currentStems.filter(function(stem) {
      const capPreenchido = stem.cap && stem.cap.toString().trim() !== '';
      const alturaPreenchida = stem.altura && stem.altura.toString().trim() !== '';
      return capPreenchido || alturaPreenchida;
    });
    
    if (fustesValidos.length === 0) {
      alert('Por favor, preencha pelo menos um fuste com CAP ou altura.');
      return;
    }
    
    dadosIndividuo.fustes = fustesValidos;
    temDados = true;
  }
  
  if (!temDados) {
    alert('Por favor, preencha pelo menos um campo antes de continuar.');
    return;
  }
  
  inventoryData.push(dadosIndividuo);
  currentInventory.dados = inventoryData;
  
  autoSave();
  
  // Limpa campos para próximo indivíduo
  inventoryColumns.forEach(function(coluna) {
    const field = document.getElementById(`field_${coluna.id}`);
    if (field) field.value = '';
  });
  
  // Remove display de coordenadas
  const coordDisplay = document.querySelector('.coordinates-display');
  if (coordDisplay) {
    coordDisplay.remove();
  }
  
  // Reset múltiplos fustes
  if (multipleStemsCheckbox) {
    multipleStemsCheckbox.checked = false;
    toggleMultipleStems();
  }
  
  currentCoordinates = null;
  currentIndividualIndex++;
  document.getElementById('currentIndividual').textContent = `Indivíduo ${currentIndividualIndex}`;
  
  // Foca no primeiro campo
  if (inventoryColumns.length > 0) {
    setTimeout(function() {
      const firstField = document.getElementById(`field_${inventoryColumns[0].id}`);
      if (firstField) firstField.focus();
    }, 100);
  }
  
  showFeedback(`Indivíduo ${currentIndividualIndex - 1} salvo!`);
}

function salvarEContinuar() {
  salvarIndividuo();
}

function autoSave() {
  if (currentInventory && inventoryData.length > 0) {
    currentInventory.ultimaColeta = new Date().toLocaleDateString('pt-BR');
    
    const existingIndex = inventarios.findIndex(function(inv) { 
      return inv.id === currentInventory.id; 
    });
    
    if (existingIndex >= 0) {
      inventarios[existingIndex] = currentInventory;
    } else {
      inventarios.push(currentInventory);
    }
    
    // Sync automático
    console.log('📊 Array inventarios após autoSave:', inventarios.length, 'inventários');
SyncStorage.save(inventarios);
    
    console.log('Dados salvos automaticamente');
  }
}

function finalizarInventario() {
  if (inventoryData.length === 0) {
    alert('Adicione pelo menos um indivíduo antes de finalizar.');
    return;
  }
  
  currentInventory.ultimaColeta = new Date().toLocaleDateString('pt-BR');
  currentInventory.status = 'finalizado';
  
  const existingIndex = inventarios.findIndex(function(inv) { 
    return inv.id === currentInventory.id; 
  });
  
  if (existingIndex >= 0) {
    inventarios[existingIndex] = currentInventory;
  } else {
    inventarios.push(currentInventory);
  }
  
  alert(`Inventário finalizado com sucesso!\n${inventoryData.length} indivíduos coletados.`);
  goTo('inventoryScreen');
}

function voltarParaInventario() {
  if (inventoryData.length > 0) {
    if (confirm('Você tem dados não salvos. O progresso será salvo automaticamente. Deseja sair?')) {
      autoSave();
      goTo('inventoryScreen');
    }
  } else {
    goTo('inventoryScreen');
  }
}

function showFeedback(message) {
  const feedback = document.createElement('div');
  feedback.textContent = message;
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s;
  `;
  
  document.body.appendChild(feedback);
  
  setTimeout(function() { feedback.style.opacity = '1'; }, 10);
  setTimeout(function() {
    feedback.style.opacity = '0';
    setTimeout(function() {
      if (document.body.contains(feedback)) {
        document.body.removeChild(feedback);
      }
    }, 300);
  }, 2000);
}

function abrirInventario(index) {
  const inventario = inventarios[index];
  if (!inventario) return;
  
  currentInventory = inventario;
  
  const titleElement = document.getElementById('inventoryDetailTitle');
  if (titleElement) {
    titleElement.textContent = inventario.nome;
  }
  
  const infoElement = document.getElementById('inventoryDetailInfo');
  if (infoElement) {
    const areaInfo = inventario.areaParcela ? 
      `<p><strong>Área da Parcela:</strong> ${inventario.areaParcela} m²</p>` : '';
    
    infoElement.innerHTML = `
      <p><strong>Local:</strong> ${inventario.local}</p>
      ${areaInfo}
      <p><strong>Data de Início:</strong> ${inventario.dataInicio}</p>
      <p><strong>Última Coleta:</strong> ${inventario.ultimaColeta}</p>
      <p><strong>Total de Indivíduos:</strong> ${inventario.dados ? inventario.dados.length : 0}</p>
      <p><strong>Status:</strong> ${inventario.status || 'Em andamento'}</p>
    `;
  }
  
  criarTabelaInventario(inventario);
  goTo('inventoryDetailScreen');
}

function criarTabelaInventario(inventario) {
  const container = document.getElementById('inventoryTable');
  if (!container) return;
  
  if (!inventario.dados || inventario.dados.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 20px;">Nenhum dado coletado ainda.</p>';
    return;
  }
  
  let tableHTML = '<table style="width: 100%; border-collapse: collapse;">';
  
  // Cabeçalho
  tableHTML += '<thead><tr style="background: #f8f9fa;">';
  tableHTML += '<th style="padding: 12px; border: 1px solid #ddd;">#</th>';
  
  inventario.colunas.forEach(function(coluna) {
    tableHTML += `<th style="padding: 12px; border: 1px solid #ddd;">${coluna.nome}</th>`;
  });
  
  tableHTML += '<th style="padding: 12px; border: 1px solid #ddd;">Fustes</th>';
  tableHTML += '<th style="padding: 12px; border: 1px solid #ddd;">Data/Hora</th>';
  tableHTML += '<th style="padding: 12px; border: 1px solid #ddd; width: 120px;">Ações</th>';
  tableHTML += '</tr></thead>';
  
  // Corpo da tabela
  tableHTML += '<tbody>';
  inventario.dados.forEach(function(linha, index) {
    tableHTML += '<tr>';
    tableHTML += `<td style="padding: 8px; border: 1px solid #ddd;">${linha.numeroIndividuo || ''}</td>`;
    
    inventario.colunas.forEach(function(coluna) {
      let valor = linha[coluna.id] || '';
      
      // Para múltiplos fustes, mostra resumo
      if ((coluna.id === 'cap' || coluna.id === 'hc' || coluna.id === 'ht') && 
          linha.multipleStems && linha.fustes) {
        if (coluna.id === 'cap') {
          valor = linha.fustes.map(function(f) { return f.cap; }).filter(function(c) { return c; }).join(', ');
        } else if (coluna.id === 'hc' || coluna.id === 'ht') {
          valor = linha.fustes.map(function(f) { return f.altura; }).filter(function(a) { return a; }).join(', ');
        }
      }
      
      tableHTML += `<td style="padding: 8px; border: 1px solid #ddd;">${valor}</td>`;
    });
    
    // Coluna de fustes
    let stemsInfo = 'Único';
    if (linha.multipleStems && linha.fustes) {
      stemsInfo = `${linha.fustes.length} fustes`;
    }
    tableHTML += `<td style="padding: 8px; border: 1px solid #ddd; color: ${linha.multipleStems ? '#f39c12' : '#666'}; font-weight: ${linha.multipleStems ? 'bold' : 'normal'};">${stemsInfo}</td>`;
    
    tableHTML += `<td style="padding: 8px; border: 1px solid #ddd; font-size: 12px; color: #666;">${linha.timestamp || ''}</td>`;
    
    // Coluna de ações
    tableHTML += `
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
        <button onclick="editarIndividuo(${index})" class="table-action-btn edit">✏️</button>
        <button onclick="excluirIndividuo(${index})" class="table-action-btn delete">🗑️</button>
      </td>
    `;
    
    tableHTML += '</tr>';
  });
  tableHTML += '</tbody></table>';
  
  container.innerHTML = tableHTML;
}

// Funções de edição
function editarIndividuo(index) {
  if (!currentInventory || !currentInventory.dados || index < 0 || index >= currentInventory.dados.length) {
    alert('Erro ao carregar dados do indivíduo.');
    return;
  }
  
  editingIndividualIndex = index;
  originalIndividualData = JSON.parse(JSON.stringify(currentInventory.dados[index]));
  
  const individuoData = currentInventory.dados[index];
  
  // Configurar título e número
  document.getElementById('editIndividualTitle').textContent = `Editar Indivíduo #${individuoData.numeroIndividuo}`;
  document.getElementById('editIndividualNumber').textContent = `Indivíduo ${individuoData.numeroIndividuo}`;
  
  // Criar campos de edição
  const container = document.getElementById('editDataCollectionCards');
  container.innerHTML = '';
  
  currentInventory.colunas.forEach(function(coluna, colIndex) {
    const card = document.createElement('div');
    card.className = 'data-collection-card';
    
    const inputType = coluna.tipo === 'number' ? 'number' : 'text';
    const inputElement = coluna.tipo === 'textarea' ? 'textarea' : 'input';
    const stepAttr = coluna.tipo === 'number' ? 'step="0.1"' : '';
    const autoFocus = colIndex === 0 ? 'autofocus' : '';
    const valorAtual = individuoData[coluna.id] || '';
    
    if (coluna.id === 'coordenadas') {
      card.innerHTML = `
        <h3>${coluna.nome}</h3>
        <input 
          type="text" 
          ${autoFocus}
          id="edit_field_${coluna.id}" 
          placeholder="Latitude, Longitude"
          value="${valorAtual}"
          readonly
          onkeydown="handleEditKeyDown(event, '${coluna.id}')"
        />
        <button type="button" class="btn-gps" onclick="obterCoordenadas()">
          📍 Atualizar GPS
        </button>
      `;
    } else {
      card.innerHTML = `
        <h3>${coluna.nome}</h3>
        <${inputElement} 
          type="${inputType}" 
          ${stepAttr} 
          ${autoFocus}
          id="edit_field_${coluna.id}" 
          placeholder="Digite ${coluna.nome.toLowerCase()}"
          value="${valorAtual}"
          onkeydown="handleEditKeyDown(event, '${coluna.id}')"
        >${coluna.tipo === 'textarea' ? valorAtual : ''}</${inputElement}>
      `;
    }
    
    container.appendChild(card);
  });
  
  // Configurar múltiplos fustes
  const editMultipleStems = document.getElementById('editMultipleStems');
  if (editMultipleStems) {
    editMultipleStems.checked = individuoData.multipleStems || false;
  }
  
  currentStems = individuoData.fustes ? JSON.parse(JSON.stringify(individuoData.fustes)) : [];
  
  // Esconder/mostrar campos baseado no estado de múltiplos fustes
  if (individuoData.multipleStems) {
    ['edit_field_cap', 'edit_field_hc', 'edit_field_ht'].forEach(function(id) {
      const field = document.getElementById(id);
      if (field) {
        field.parentElement.style.display = 'none';
      }
    });
    
    const editStemsContainer = document.getElementById('editStemsContainer');
    if (editStemsContainer) {
      editStemsContainer.style.display = 'block';
      renderEditStems();
    }
  } else {
    const editStemsContainer = document.getElementById('editStemsContainer');
    if (editStemsContainer) {
      editStemsContainer.style.display = 'none';
    }
  }
  
  // Carregar coordenadas se existirem
  if (individuoData.coordenadas_detalhadas) {
    currentCoordinates = individuoData.coordenadas_detalhadas;
  }
  
  goTo('editIndividualScreen');
}

function handleEditKeyDown(event, currentFieldId) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    
    const currentIndex = currentInventory.colunas.findIndex(function(col) { 
      return col.id === currentFieldId; 
    });
    
    if (currentIndex < currentInventory.colunas.length - 1) {
      const nextFieldId = currentInventory.colunas[currentIndex + 1].id;
      const nextField = document.getElementById(`edit_field_${nextFieldId}`);
      if (nextField && nextField.parentElement.style.display !== 'none') {
        nextField.focus();
      }
    } else {
      salvarEdicaoIndividuo();
    }
  }
}

// Múltiplos Fustes na Edição
function toggleEditMultipleStems() {
  const isChecked = document.getElementById('editMultipleStems').checked;
  const container = document.getElementById('editStemsContainer');
  
  if (container) {
    container.style.display = isChecked ? 'block' : 'none';
    
    // Esconde/mostra campos CAP e altura
    ['edit_field_cap', 'edit_field_hc', 'edit_field_ht'].forEach(function(id) {
      const field = document.getElementById(id);
      if (field) {
        field.parentElement.style.display = isChecked ? 'none' : 'block';
      }
    });
    
    if (isChecked && currentStems.length === 0) {
      adicionarFusteEdit();
    } else if (isChecked) {
      renderEditStems();
    }
  }
}

function adicionarFusteEdit() {
  const stemId = `stem_${Date.now()}_${Math.random()}`;
  currentStems.push({
    id: stemId,
    cap: '',
    altura: ''
  });
  renderEditStems();
}

function removerFusteEdit(stemId) {
  currentStems = currentStems.filter(function(stem) { return stem.id !== stemId; });
  
  if (currentStems.length === 0) {
    adicionarFusteEdit();
  } else {
    renderEditStems();
  }
}

function renderEditStems() {
  const container = document.getElementById('editStemsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  currentStems.forEach(function(stem, index) {
    const card = document.createElement('div');
    card.className = 'stem-card';
    
    const removeButton = currentStems.length > 1 ? 
      `<button type="button" class="remove-stem-btn" onclick="removerFusteEdit('${stem.id}')">✕</button>` : 
      '<div style="width: 40px;"></div>';
    
    card.innerHTML = `
      <h4>Fuste ${index + 1}</h4>
      <div class="stem-inputs">
        <input 
          type="number" 
          step="0.1" 
          placeholder="CAP (cm)" 
          value="${stem.cap || ''}"
          oninput="updateEditStem('${stem.id}', 'cap', this.value)"
        />
        <input 
          type="number" 
          step="0.1" 
          placeholder="Altura (m)" 
          value="${stem.altura || ''}"
          oninput="updateEditStem('${stem.id}', 'altura', this.value)"
        />
        ${removeButton}
      </div>
    `;
    
    container.appendChild(card);
  });
}

function updateEditStem(stemId, field, value) {
  const stem = currentStems.find(function(s) { return s.id === stemId; });
  if (stem) {
    stem[field] = value;
  }
}

function salvarEdicaoIndividuo() {
  if (editingIndividualIndex < 0 || !currentInventory) {
    alert('Erro ao salvar alterações.');
    return;
  }
  
  const dadosAtualizados = {
    numeroIndividuo: originalIndividualData.numeroIndividuo,
    timestamp: originalIndividualData.timestamp,
    timestampEdicao: new Date().toLocaleString('pt-BR')
  };
  
  const isMultipleStems = document.getElementById('editMultipleStems').checked;
  dadosAtualizados.multipleStems = isMultipleStems;
  
  let temDados = false;
  
  // Coletar dados dos campos de edição
  currentInventory.colunas.forEach(function(coluna) {
    const field = document.getElementById(`edit_field_${coluna.id}`);
    if (field && field.parentElement.style.display !== 'none') {
      const valor = field.value.trim();
      dadosAtualizados[coluna.id] = valor;
      if (valor) temDados = true;
    }
  });

  // Atualizar coordenadas detalhadas se foram modificadas
  if (currentCoordinates) {
    dadosAtualizados.coordenadas_detalhadas = currentCoordinates;
  } else if (originalIndividualData.coordenadas_detalhadas) {
    dadosAtualizados.coordenadas_detalhadas = originalIndividualData.coordenadas_detalhadas;
  }
  
  // Se múltiplos fustes
  if (isMultipleStems) {
    if (currentStems.length === 0) {
      alert('Por favor, adicione pelo menos um fuste.');
      return;
    }
    
    const fustesValidos = currentStems.filter(function(stem) {
      const capPreenchido = stem.cap && stem.cap.toString().trim() !== '';
      const alturaPreenchida = stem.altura && stem.altura.toString().trim() !== '';
      return capPreenchido || alturaPreenchida;
    });
    
    if (fustesValidos.length === 0) {
      alert('Por favor, preencha pelo menos um fuste com CAP ou altura.');
      return;
    }
    
    dadosAtualizados.fustes = fustesValidos;
    temDados = true;
  }
  
  if (!temDados) {
    alert('Por favor, preencha pelo menos um campo antes de salvar.');
    return;
  }
  
  // Atualizar o array de dados
  currentInventory.dados[editingIndividualIndex] = dadosAtualizados;
  currentInventory.ultimaColeta = new Date().toLocaleDateString('pt-BR');
  
  // Salvar no array principal de inventários
  const inventarioIndex = inventarios.findIndex(function(inv) { 
    return inv.id === currentInventory.id; 
  });
  
  if (inventarioIndex >= 0) {
    inventarios[inventarioIndex] = currentInventory;
  }
  
  showFeedback('Indivíduo atualizado com sucesso!');
  
  // Limpar variáveis de edição
  editingIndividualIndex = -1;
  originalIndividualData = null;
  currentCoordinates = null;
  currentStems = [];
  
  // Voltar para a tela de detalhes e atualizar a tabela
  goTo('inventoryDetailScreen');
  criarTabelaInventario(currentInventory);
}

function cancelarEdicaoIndividuo() {
  if (confirm('Deseja cancelar a edição? As alterações serão perdidas.')) {
    editingIndividualIndex = -1;
    originalIndividualData = null;
    currentCoordinates = null;
    currentStems = [];
    goTo('inventoryDetailScreen');
  }
}

function excluirIndividuo(index) {
  if (!currentInventory || !currentInventory.dados || index < 0 || index >= currentInventory.dados.length) {
    alert('Erro ao excluir indivíduo.');
    return;
  }
  
  const individuo = currentInventory.dados[index];
  const numeroIndividuo = individuo.numeroIndividuo || (index + 1);
  
  const confirmMessage = `Tem certeza que deseja excluir o Indivíduo #${numeroIndividuo}?\n\nEsta ação não pode ser desfeita.`;
  
  if (confirm(confirmMessage)) {
    // Remover o indivíduo do array
    currentInventory.dados.splice(index, 1);
    currentInventory.ultimaColeta = new Date().toLocaleDateString('pt-BR');
    
    // Renumerar os indivíduos restantes
    currentInventory.dados.forEach(function(item, newIndex) {
      item.numeroIndividuo = newIndex + 1;
    });
    
    // Salvar no array principal de inventários
    const inventarioIndex = inventarios.findIndex(function(inv) { 
      return inv.id === currentInventory.id; 
    });
    
    if (inventarioIndex >= 0) {
      inventarios[inventarioIndex] = currentInventory;
    }
    
    showFeedback(`Indivíduo #${numeroIndividuo} excluído com sucesso!`);
    
    // Atualizar a tabela
    criarTabelaInventario(currentInventory);
    
    // Atualizar info do inventário
    const infoElement = document.getElementById('inventoryDetailInfo');
    if (infoElement) {
      const areaInfo = currentInventory.areaParcela ? 
        `<p><strong>Área da Parcela:</strong> ${currentInventory.areaParcela} m²</p>` : '';
      
      infoElement.innerHTML = `
        <p><strong>Local:</strong> ${currentInventory.local}</p>
        ${areaInfo}
        <p><strong>Data de Início:</strong> ${currentInventory.dataInicio}</p>
        <p><strong>Última Coleta:</strong> ${currentInventory.ultimaColeta}</p>
        <p><strong>Total de Indivíduos:</strong> ${currentInventory.dados ? currentInventory.dados.length : 0}</p>
        <p><strong>Status:</strong> ${currentInventory.status || 'Em andamento'}</p>
      `;
    }
  }
}

function continuarInventario() {
  if (!currentInventory) return;
  
  inventoryColumns = currentInventory.colunas;
  inventoryData = currentInventory.dados || [];
  currentIndividualIndex = inventoryData.length + 1;
  
  prepararTelaColeta();
  goTo('inventoryCollectionScreen');
}

function duplicarInventario() {
  if (!currentInventory) {
    alert('Nenhum inventário selecionado.');
    return;
  }
  
  goTo('inventorySetupScreen');
  
  document.getElementById('inventoryName').value = currentInventory.nome + ' - Cópia';
  document.getElementById('inventoryLocation').value = currentInventory.local;
  document.getElementById('plotArea').value = currentInventory.areaParcela;
  
  const checkboxes = document.querySelectorAll('#columnOptions input[type="checkbox"]');
  checkboxes.forEach(function(cb) { cb.checked = false; });
  
  currentInventory.colunas.forEach(function(coluna) {
    const checkbox = document.querySelector(`input[value="${coluna.id}"]`);
    if (checkbox) checkbox.checked = true;
  });
  
  showFeedback('Configuração duplicada! Ajuste os dados e inicie a coleta.');
}

function excluirInventario() {
  if (!currentInventory) {
    alert('Nenhum inventário selecionado.');
    return;
  }
  
  const confirmMessage = `Tem certeza que deseja excluir o inventário "${currentInventory.nome}"?\n\nEsta ação não pode ser desfeita.`;
  
  if (confirm(confirmMessage)) {
    const inventarioIndex = inventarios.findIndex(function(inv) { 
      return inv.id === currentInventory.id; 
    });
    
    if (inventarioIndex >= 0) {
      inventarios.splice(inventarioIndex, 1);
      showFeedback('Inventário excluído com sucesso!');
      goTo('inventoryScreen');
    }
  }
}

// Exportação
function abrirModalExport() {
  if (!currentInventory || !currentInventory.dados || currentInventory.dados.length === 0) {
    alert('Não há dados para exportar.');
    return;
  }
  
  const modal = document.getElementById('exportModal');
  if (modal) {
    modal.style.display = 'flex';
    
    // Reset das opções
    const dadosRadio = document.querySelector('input[name="exportPackage"][value="dados"]');
    if (dadosRadio) dadosRadio.checked = true;
    
    toggleCustomCalculations(false);
  }
}

function fecharModalExport() {
  const modal = document.getElementById('exportModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function toggleCustomCalculations(show) {
  const customDiv = document.getElementById('customCalculations');
  if (customDiv) {
    customDiv.style.display = show ? 'block' : 'none';
    
    if (show) {
      // Marca todos os cálculos por padrão quando customizado
      const checkboxes = customDiv.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(function(cb) { cb.checked = true; });
    }
  }
}

function executarExport() {
  if (!currentInventory || !currentInventory.dados || currentInventory.dados.length === 0) {
    alert('Não há dados para exportar.');
    return;
  }
  
  // Pega o pacote selecionado
  const packageSelected = document.querySelector('input[name="exportPackage"]:checked')?.value || 'dados';
  const fatorForma = parseFloat(document.getElementById('fatorForma')?.value || 0.5);
  
  let dadosCompletos = [];
  let calculosIncluir = [];
  
  // Define quais cálculos incluir baseado no pacote
  switch (packageSelected) {
    case 'dados':
      calculosIncluir = [];
      break;
    case 'basico':
      calculosIncluir = ['dap_calculado', 'area_seccional', 'volume_individual', 'densidade_ha'];
      break;
    case 'completo':
      calculosIncluir = ['dap_calculado', 'area_seccional', 'volume_individual', 'area_basal_ha', 'volume_ha', 'densidade_ha', 'dap_medio'];
      break;
    case 'customizado':
      // Pega os checkboxes marcados
      const checkboxes = document.querySelectorAll('#customCalculations input[type="checkbox"]:checked');
      calculosIncluir = Array.from(checkboxes).map(function(cb) { return cb.value; });
      break;
  }
  
  // Cabeçalho base
  const cabecalho = ['Indivíduo'];
  currentInventory.colunas.forEach(function(coluna) {
    cabecalho.push(coluna.nome);
  });
  cabecalho.push('Fustes', 'Data/Hora');
  
  // Adiciona colunas de cálculos
  if (calculosIncluir.includes('dap_calculado')) cabecalho.push('DAP Calculado (cm)');
  if (calculosIncluir.includes('area_seccional')) cabecalho.push('Área Seccional (m²)');
  if (calculosIncluir.includes('volume_individual')) cabecalho.push('Volume Individual (m³)');
  if (calculosIncluir.includes('area_basal_ha')) cabecalho.push('Área Basal/ha (m²/ha)');
  if (calculosIncluir.includes('volume_ha')) cabecalho.push('Volume/ha (m³/ha)');
  if (calculosIncluir.includes('densidade_ha')) cabecalho.push('Densidade/ha (ind/ha)');
  if (calculosIncluir.includes('dap_medio')) cabecalho.push('DAP Médio Quadrático (cm)');
  
  dadosCompletos.push(cabecalho);
  
  // Cálculos agregados
  const fatorExpansao = currentInventory.fatorExpansao || (10000 / currentInventory.areaParcela);
  let somaAreaSeccional = 0;
  let somaVolume = 0;
  let totalIndividuos = currentInventory.dados.length;
  let somaDapQuadrado = 0;
  let individuosComDap = 0;
  
  // Primeira passada para calcular totais
  currentInventory.dados.forEach(function(individuo) {
    const daps = obterDapsIndividuo(individuo);
    daps.forEach(function(dap) {
      if (dap > 0) {
        somaDapQuadrado += dap * dap;
        individuosComDap++;
      }
    });
  });
  
  const dapMedioQuadratico = individuosComDap > 0 ? Math.sqrt(somaDapQuadrado / individuosComDap) : 0;
  
  // Processa cada indivíduo
  currentInventory.dados.forEach(function(individuo) {
    const linha = [];
    linha.push(individuo.numeroIndividuo || '');
    
    // Dados originais das colunas
    currentInventory.colunas.forEach(function(coluna) {
      let valor = individuo[coluna.id] || '';
      
      // Para múltiplos fustes, concatena valores
      if ((coluna.id === 'cap' || coluna.id === 'hc' || coluna.id === 'ht') && 
          individuo.multipleStems && individuo.fustes) {
        if (coluna.id === 'cap') {
          valor = individuo.fustes.map(function(f) { return f.cap; }).filter(function(c) { return c; }).join('; ');
        } else if (coluna.id === 'hc' || coluna.id === 'ht') {
          valor = individuo.fustes.map(function(f) { return f.altura; }).filter(function(a) { return a; }).join('; ');
        }
      }
      
      linha.push(valor);
    });
    
    // Fustes
    if (individuo.multipleStems && individuo.fustes) {
      linha.push(`${individuo.fustes.length} fustes`);
    } else {
      linha.push('Único');
    }
    
    linha.push(individuo.timestamp || '');
    
    // Cálculos florestais
    if (calculosIncluir.length > 0) {
      const daps = obterDapsIndividuo(individuo);
      const alturas = obterAlturasIndividuo(individuo);
      
      // DAP Calculado
      if (calculosIncluir.includes('dap_calculado')) {
        linha.push(daps.map(function(d) { return d.toFixed(2); }).join('; '));
      }
      
      // Área Seccional Individual
      if (calculosIncluir.includes('area_seccional')) {
        const areaSeccional = daps.reduce(function(sum, dap) {
          return sum + (Math.PI * Math.pow(dap / 200, 2));
        }, 0);
        linha.push(areaSeccional.toFixed(6));
        somaAreaSeccional += areaSeccional;
      }
      
      // Volume Individual
      if (calculosIncluir.includes('volume_individual')) {
        let volumeTotal = 0;
        daps.forEach(function(dap, index) {
          const altura = alturas[index] || alturas[0] || 0;
          if (dap > 0 && altura > 0) {
            const areaSeccionalFuste = Math.PI * Math.pow(dap / 200, 2);
            volumeTotal += areaSeccionalFuste * altura * fatorForma;
          }
        });
        const volumeHa = volumeTotal * fatorExpansao;
        linha.push(volumeHa.toFixed(2));
      }
      
      // Densidade por Hectare
      if (calculosIncluir.includes('densidade_ha')) {
        linha.push(fatorExpansao.toFixed(2));
      }
      
      // DAP Médio Quadrático
      if (calculosIncluir.includes('dap_medio')) {
        linha.push(dapMedioQuadratico.toFixed(2));
      }
    }
    
    dadosCompletos.push(linha);
  });
  
  // Adiciona linha de totais se houver cálculos
  if (calculosIncluir.length > 0 && (calculosIncluir.includes('area_basal_ha') || calculosIncluir.includes('volume_ha') || calculosIncluir.includes('densidade_ha'))) {
    const linhaTotais = ['TOTAIS'];
    
    // Preenche colunas vazias até os cálculos
    for (let i = 1; i < cabecalho.length; i++) {
      if (cabecalho[i] === 'Área Basal/ha (m²/ha)') {
        linhaTotais.push((somaAreaSeccional * fatorExpansao).toFixed(2));
      } else if (cabecalho[i] === 'Volume/ha (m³/ha)') {
        linhaTotais.push((somaVolume * fatorExpansao).toFixed(2));
      } else if (cabecalho[i] === 'Densidade/ha (ind/ha)') {
        linhaTotais.push((totalIndividuos * fatorExpansao).toFixed(2));
      } else if (cabecalho[i] === 'DAP Médio Quadrático (cm)') {
        linhaTotais.push(dapMedioQuadratico.toFixed(2));
      } else {
        linhaTotais.push('');
      }
    }
    
    dadosCompletos.push(linhaTotais);
  }
  
  // Converter para CSV
  let csvContent = '';
  dadosCompletos.forEach(function(linha) {
    const linhaCsv = linha.map(function(campo) {
      const campoStr = String(campo || '');
      if (campoStr.includes(',') || campoStr.includes(';') || campoStr.includes('\n') || campoStr.includes('"')) {
        return `"${campoStr.replace(/"/g, '""')}"`;
      }
      return campoStr;
    }).join(';');
    
    csvContent += linhaCsv + '\n';
  });
  
  // BOM para caracteres especiais
  const BOM = '\uFEFF';
  csvContent = BOM + csvContent;
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const tipoExport = packageSelected === 'dados' ? 'dados' : 'calculado';
  const nomeArquivo = `${currentInventory.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${tipoExport}_${new Date().toISOString().split('T')[0]}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', nomeArquivo);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  alert(`Arquivo exportado com sucesso!\nTipo: ${packageSelected}\nCálculos incluídos: ${calculosIncluir.length}`);
  fecharModalExport();
}

// Funções auxiliares para cálculos florestais
function obterDapsIndividuo(individuo) {
  const daps = [];
  
  if (individuo.multipleStems && individuo.fustes) {
    // Múltiplos fustes
    individuo.fustes.forEach(function(fuste) {
      if (fuste.cap && fuste.cap > 0) {
        const dap = fuste.cap / Math.PI;
        daps.push(dap);
      }
    });
  } else {
    // Fuste único
    if (individuo.dap && individuo.dap > 0) {
      daps.push(parseFloat(individuo.dap));
    } else if (individuo.cap && individuo.cap > 0) {
      const dap = individuo.cap / Math.PI;
      daps.push(dap);
    }
  }
  
  return daps.filter(function(dap) { return dap > 0; });
}

function obterAlturasIndividuo(individuo) {
  const alturas = [];
  
  if (individuo.multipleStems && individuo.fustes) {
    // Múltiplos fustes
    individuo.fustes.forEach(function(fuste) {
      if (fuste.altura && fuste.altura > 0) {
        alturas.push(parseFloat(fuste.altura));
      }
    });
  } else {
    // Fuste único
    if (individuo.ht && individuo.ht > 0) {
      alturas.push(parseFloat(individuo.ht));
    } else if (individuo.hc && individuo.hc > 0) {
      alturas.push(parseFloat(individuo.hc));
    }
  }
  
  return alturas.filter(function(altura) { return altura > 0; });
}

// Atalhos de teclado
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const activeScreen = document.querySelector('.screen.active').id;
    if (activeScreen === 'inventoryCollectionScreen') {
      salvarIndividuo();
    } else if (activeScreen === 'editIndividualScreen') {
      salvarEdicaoIndividuo();
    }
  }
  
  if (e.key === 'Escape') {
    const activeScreen = document.querySelector('.screen.active').id;
    if (activeScreen === 'inventoryCollectionScreen') {
      voltarParaInventario();
    } else if (activeScreen === 'editIndividualScreen') {
      cancelarEdicaoIndividuo();
    }
  }
});

console.log('LeafTag carregado com sucesso!');