export type AppLanguage = 'es' | 'en';

export const TRANSLATIONS = {
  es: {
    common: {
      menu: 'Menú',
      workspace: 'Workspace',
      localWorkspace: 'Espacio Local',
      settings: 'Configuraciones',
      save: 'Guardar Cambios',
      close: 'Cerrar',
      clear: 'Limpiar',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      language: 'Idioma',
      spanish: 'Español',
      english: 'English',
      active: 'Activo',
      offline: 'Sin conexión',
      onDevice: '100% En Dispositivo',
      newBadge: '¡Nuevo!',
      loading: 'Cargando...'
    },
    hero: {
      titlePrefix: '¿Por dónde',
      titleHighlight: 'empezamos hoy?',
      subtitle:
        'Cuéntame qué quieres lograr por voz o teclado. Primero extraeremos tu contexto estratégico y abriremos Studio antes de dividir tus micro-pasos.',
      inputPlaceholder: 'Describe tu meta, proyecto o desahógate con el micrófono...',
      inputPlaceholderVoiceActive: 'Escuchando tu desahogo en vivo... Habla libremente sin prisas...',
      inputPlaceholderKeyboardPrecision: 'Escribe con precisión el parámetro o entregable concreto...',
      startTooltip: 'Contextualizar y Abrir Studio',
      syncingFeedback: 'Sincronizando contexto con Google Gemini y preparando Studio...',
      privacyFooter: '100% biometría local procesada en GPU • Privacidad en Dispositivo',
      modeLabel: 'Modo',
      workModes: {
        pantalla: 'Pantalla',
        lectura: 'Lectura',
        flexible: 'Flexible'
      },
      sensitivities: {
        estricto: 'Estricto',
        normal: 'Balanceado',
        relajado: 'Relajado'
      },
      sensitivityDesc: {
        estricto: 'Rápido',
        normal: 'Estándar',
        relajado: 'Suave'
      },
      quickPrompts: {
        focusModeLabel: 'Modo Enfoque',
        focusModeText: 'Completar mi entregable prioritario de hoy',
        sprintLabel: 'Sprint 25m',
        sprintText: 'Sprint de 25 minutos de enfoque profundo sin distracciones',
        atomicLabel: 'Desglose Atómico',
        atomicText: 'Estructurar y dividir un proyecto complejo en micro-pasos',
        readingLabel: 'Lectura Profunda',
        readingText: 'Lectura crítica y síntesis de documentación técnica'
      },
      envCalibrationTitle: 'Calibración de Entorno',
      activityProfileLabel: 'Perfil de Actividad:',
      alertToleranceLabel: 'Tolerancia de Alertas IA:',
      confirmSettingsBtn: 'Confirmar Ajustes'
    },
    sidebar: {
      newSession: 'Nueva Sesión',
      savedSessions: 'Sesiones Guardadas',
      noSessionsTitle: 'Aún no hay sesiones registradas',
      noSessionsDesc: 'Cada sesión que inicies se guardará automáticamente en tu equipo.',
      toolsAndData: 'Herramientas y Datos',
      quickNotebook: 'Bloc de Notas Rápido',
      settingsAndAi: 'Configuraciones e IA',
      exportRecords: 'Exportar Historial (JSON)',
      importRecords: 'Importar Historial',
      clearHistory: 'Borrar Historial Local',
      clearConfirm: '¿Deseas borrar todo el historial de sesiones guardado en esta computadora? Esta acción no se puede deshacer.',
      importSuccess: '¡Historial de sesiones importado correctamente!',
      importError: 'Formato de archivo JSON de NeuroSynk inválido.',
      focusUser: 'Usuario NeuroSynk',
      privateStorage: 'Almacenamiento Local Privado',
      sessionSummary: 'Resumen de Sesión',
      goal: 'Meta:',
      duration: 'Duración',
      steps: 'Pasos',
      focus: 'Enfoque',
      aiDebrief: 'Debrief Cognitivo IA:',
      resumeRepeat: 'Retomar / Repetir',
      quickNotebookTitle: 'Bloc Cognitivo Rápido',
      quickNotebookPlaceholder: 'Anota ideas repentinas, pendientes o pensamientos sin romper tu estado de flujo...',
      autoSaved: 'Guardado automático en tu navegador',
      done: 'Listo',
      justNow: 'Ahora mismo',
      minsAgo: 'hace {n}m',
      todayHoursAgo: 'Hoy, hace {n}h',
      yesterday: 'Ayer',
      daysAgo: 'hace {n}d'
    },
    settingsModal: {
      title: 'Centro de Configuraciones NeuroSynk',
      subtitle: 'Idioma Bilingüe • Cascada Google Gemini • Voz Multimodal • Biometría',
      tabs: {
        general: 'Idioma y General',
        ai: 'IA y API Key',
        voice: 'Voz y Audio',
        biometrics: 'Biometría'
      },
      languageSectionTitle: 'Idioma del Sistema y del Asistente IA',
      languageSectionDesc:
        'Cambia en tiempo real el idioma de toda la interfaz, del reconocimiento de voz (STT), la voz de FocusBud (TTS) y las respuestas de Google Gemini.',
      bilingualHint: 'Modo Bilingüe Activo: Puedes alternar entre Español e Inglés en cualquier momento sin perder tu sesión.',
      aiSectionTitle: 'Motor Google Gemini (Cascada de Producción)',
      aiCascadeLabel: 'Prioridad de Modelos Activa:',
      apiKeyLabel: 'Clave API de Google Gemini (Opcional si el servidor ya tiene una):',
      apiKeyPlaceholder: 'Pega tu clave aquí (AIzaSy...)',
      getKeyAt: 'Obtén tu clave gratis en',
      testConnection: '⚡ Probar Conexión',
      testingConnection: 'Probando...',
      voiceSectionTitle: 'Entrada Multimodal Asimétrica y Audio',
      ttsToggleLabel: 'Voz Empática de FocusBud (Text-to-Speech)',
      ttsToggleDesc: 'Permite que FocusBud hable resúmenes y alertas con cancelación automática cuando abres el micrófono.',
      earconsToggleLabel: 'Sonidos Armónicos de Estado (Web Audio API)',
      earconsToggleDesc: ' Tonos binaurales suaves para transiciones de enfoque y pausas somáticas.',
      micModeLabel: 'Modo de Micrófono para Desahogo (Voz):',
      micModeContinuous: 'Desahogo Continuo (Manos libres con auto-reconexión)',
      micModePush: 'Pulsar para Hablar (Push-to-Talk)',
      biometricsSectionTitle: 'Calibración Biométrica y Productividad',
      recalibrateBtn: '🔄 Recalibrar Postura y Fatiga Ocular Ahora',
      savedSuccess: 'Configuraciones guardadas correctamente'
    },
    studio: {
      panelTitle: 'Studio',
      bannerText: 'Ahora puedes generar 50 ideas Brian Tracy, mapas mentales y rutas paso a paso',
      bannerCta: 'Probar',
      tools: {
        brianTracy50: '50 Ideas Brian Tracy',
        mindMap: 'Mapa mental',
        audioSummary: 'Resumen en audio',
        videoBrief: 'Guía visual',
        flashcards: 'Tarjetas de pasos',
        quiz: 'Cuestionario',
        infographic: ' Diagrama de flujo',
        dataTable: 'Tabla de impacto'
      },
      emptySavedTitle: 'Los resultados de Studio se guardarán aquí.',
      emptySavedDesc:
        'Luego de contextualizar tu meta por voz o teclado, haz clic arriba para generar las 50 ideas de Brian Tracy, un mapa mental, cuestionario o ruta de enfoque.',
      generatingLabel: 'Generando en Studio...',
      readyToOpen: 'Listo • Clic para abrir'
    }
  },
  en: {
    common: {
      menu: 'Menu',
      workspace: 'Workspace',
      localWorkspace: 'Local Workspace',
      settings: 'Settings',
      save: 'Save Changes',
      close: 'Close',
      clear: 'Clear',
      cancel: 'Cancel',
      confirm: 'Confirm',
      language: 'Language',
      spanish: 'Español',
      english: 'English',
      active: 'Active',
      offline: 'Offline',
      onDevice: '100% On-Device',
      newBadge: 'New!',
      loading: 'Loading...'
    },
    hero: {
      titlePrefix: 'Where should we',
      titleHighlight: 'start today?',
      subtitle:
        'Share what you want to achieve by voice or keyboard. First we will extract your strategic context and open Studio before splitting micro-steps.',
      inputPlaceholder: 'Enter your goal, project, or vent freely with the microphone...',
      inputPlaceholderVoiceActive: 'Listening to your live brain-dump... Speak freely at your own pace...',
      inputPlaceholderKeyboardPrecision: 'Type the exact technical parameter or deliverable...',
      startTooltip: 'Contextualize & Open Studio',
      syncingFeedback: 'Syncing context with Google Gemini and preparing Studio...',
      privacyFooter: '100% GPU-processed local biometrics • On-Device Privacy',
      modeLabel: 'Mode',
      workModes: {
        pantalla: 'Screen',
        lectura: 'Reading',
        flexible: 'Flexible'
      },
      sensitivities: {
        estricto: 'Strict',
        normal: 'Balanced',
        relajado: 'Relaxed'
      },
      sensitivityDesc: {
        estricto: 'Fast',
        normal: 'Standard',
        relajado: 'Gentle'
      },
      quickPrompts: {
        focusModeLabel: 'Focus Mode',
        focusModeText: 'Complete my top priority deliverable for today',
        sprintLabel: '25m Sprint',
        sprintText: '25-minute distraction-free focus sprint',
        atomicLabel: 'Atomic Breakdown',
        atomicText: 'Structure and break down a complex project into micro-steps',
        readingLabel: 'Deep Reading',
        readingText: 'Critical reading and synthesis of technical notes'
      },
      envCalibrationTitle: 'Environment Calibration',
      activityProfileLabel: 'Activity Profile:',
      alertToleranceLabel: 'AI Alert Tolerance:',
      confirmSettingsBtn: 'Confirm Settings'
    },
    sidebar: {
      newSession: 'New Session',
      savedSessions: 'Saved Sessions',
      noSessionsTitle: 'No recorded sessions yet',
      noSessionsDesc: 'Every session you start will be saved automatically on your computer.',
      toolsAndData: 'Tools & Data',
      quickNotebook: 'Quick Notebook',
      settingsAndAi: 'Settings & AI Link',
      exportRecords: 'Export Records (JSON)',
      importRecords: 'Import Records',
      clearHistory: 'Clear Local History',
      clearConfirm: 'Do you want to clear all saved session history on this computer? This action cannot be undone.',
      importSuccess: 'Session history imported successfully!',
      importError: 'Invalid NeuroSynk JSON file format.',
      focusUser: 'Focus User',
      privateStorage: 'Private Local Storage',
      sessionSummary: 'Session Summary',
      goal: 'Goal:',
      duration: 'Duration',
      steps: 'Steps',
      focus: 'Focus',
      aiDebrief: 'AI Cognitive Debrief:',
      resumeRepeat: 'Resume / Repeat',
      quickNotebookTitle: 'Quick Cognitive Notebook',
      quickNotebookPlaceholder: 'Jot down sudden ideas, questions, or thoughts without breaking your flow state...',
      autoSaved: 'Auto-saved in your browser',
      done: 'Done',
      justNow: 'Just now',
      minsAgo: '{n}m ago',
      todayHoursAgo: 'Today, {n}h ago',
      yesterday: 'Yesterday',
      daysAgo: '{n}d ago'
    },
    settingsModal: {
      title: 'NeuroSynk Settings Center',
      subtitle: 'Bilingual Language • Google Gemini Cascade • Multimodal Voice • Biometrics',
      tabs: {
        general: 'Language & General',
        ai: 'AI & API Key',
        voice: 'Voice & Audio',
        biometrics: 'Biometrics'
      },
      languageSectionTitle: 'System & AI Assistant Language',
      languageSectionDesc:
        'Switch in real time the language of the entire interface, voice recognition (STT), FocusBud voice synthesis (TTS), and Google Gemini responses.',
      bilingualHint: 'Bilingual Mode Active: You can switch between Spanish and English anytime without losing your session.',
      aiSectionTitle: 'Google Gemini Engine (Production Cascade)',
      aiCascadeLabel: 'Active Model Priority Cascade:',
      apiKeyLabel: 'Google Gemini API Key (Optional if server already provides one):',
      apiKeyPlaceholder: 'Paste your key here (AIzaSy...)',
      getKeyAt: 'Get your free key at',
      testConnection: '⚡ Test Connection',
      testingConnection: 'Testing...',
      voiceSectionTitle: 'Asymmetric Multimodal Input & Audio',
      ttsToggleLabel: 'FocusBud Empathetic Voice (Text-to-Speech)',
      ttsToggleDesc: 'Allows FocusBud to speak summaries and alerts with automatic mute when your microphone opens.',
      earconsToggleLabel: 'Harmonic State Earcons (Web Audio API)',
      earconsToggleDesc: 'Gentle binaural tones for focus state transitions and somatic pauses.',
      micModeLabel: 'Microphone Mode for Brain-Dump (Voice):',
      micModeContinuous: 'Continuous Brain-Dump (Hands-free with auto-reconnect)',
      micModePush: 'Push-to-Talk',
      biometricsSectionTitle: 'Biometric Calibration & Productivity',
      recalibrateBtn: '🔄 Recalibrate Posture & Eye Fatigue Now',
      savedSuccess: 'Settings saved successfully'
    },
    studio: {
      panelTitle: 'Studio',
      bannerText: 'Now you can generate 50 Brian Tracy ideas, mind maps, and step-by-step roadmaps',
      bannerCta: 'Try now',
      tools: {
        brianTracy50: '50 Brian Tracy Ideas',
        mindMap: 'Mind map',
        audioSummary: 'Audio overview',
        videoBrief: 'Visual guide',
        flashcards: 'Step flashcards',
        quiz: 'Questionnaire',
        infographic: 'Flow diagram',
        dataTable: 'Impact table'
      },
      emptySavedTitle: 'Studio results will be saved here.',
      emptySavedDesc:
        'After contextualizing your goal via voice or keyboard, click above to generate 50 Brian Tracy ideas, a mind map, questionnaire, or focus roadmap.',
      generatingLabel: 'Generating in Studio...',
      readyToOpen: 'Ready • Click to open'
    }
  }
} as const;

export type TranslationDictionary = (typeof TRANSLATIONS)['es'];

