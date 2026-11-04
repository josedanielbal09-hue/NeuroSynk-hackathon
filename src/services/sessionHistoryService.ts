/**
 * NeuroSynk Cognitive Session History Service
 * 100% Client-Side Local Storage (Private & Isolated Per-User Device)
 * Supports 100+ session records per machine with export/import capabilities
 */

export interface SavedSessionItem {
  id: string;
  task: string;
  timestamp: number;
  durationMinutes: number;
  completedSteps: number;
  totalSteps: number;
  avgFocus: number;
  debriefSummary?: string;
  status?: 'COMPLETADA' | 'EN_PROGRESO';
}

const STORAGE_KEY = 'neurosynk_session_history';

export function getSessionHistory(): SavedSessionItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[SessionHistory] Error parsing storage:', e);
    return [];
  }
}

export function saveSessionItem(session: SavedSessionItem): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getSessionHistory();
    const existingIndex = history.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      history[existingIndex] = {
        ...history[existingIndex],
        ...session,
        // Mantener timestamp original de inicio
        timestamp: history[existingIndex].timestamp || session.timestamp
      };
    } else {
      history.unshift(session);
    }

    // Hasta 100 registros por computadora de usuario
    const trimmed = history.slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

    window.dispatchEvent(new CustomEvent('neurosynk_session_updated', {
      detail: trimmed
    }));
  } catch (e) {
    console.warn('[SessionHistory] Error saving session:', e);
  }
}

export function deleteSessionItem(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getSessionHistory().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    window.dispatchEvent(new CustomEvent('neurosynk_session_updated', {
      detail: history
    }));
  } catch (e) {
    console.warn('[SessionHistory] Error deleting session:', e);
  }
}

export function clearSessionHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('neurosynk_session_updated', {
      detail: []
    }));
  } catch (e) {
    console.warn('[SessionHistory] Error clearing history:', e);
  }
}

export function exportSessionHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getSessionHistory();
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurosynk_history_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('[SessionHistory] Error exporting history:', e);
  }
}

export function importSessionHistory(jsonText: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(item => item && typeof item.task === 'string' && typeof item.id === 'string');
      if (valid.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(valid.slice(0, 100)));
        window.dispatchEvent(new CustomEvent('neurosynk_session_updated', {
          detail: valid
        }));
        return true;
      }
    }
  } catch (e) {
    console.warn('[SessionHistory] Error importing history:', e);
  }
  return false;
}
