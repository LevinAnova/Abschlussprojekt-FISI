// Hauptfunktionen für das CMS
const cmsApi = {
  baseUrl: '/api',
  
  // Alle Kategorien abrufen
  async getCategories() {
    const response = await fetch(`${this.baseUrl}/categories`);
    if (!response.ok) throw new Error('Fehler beim Laden der Kategorien');
    return await response.json();
  },
  
  // Kategorie erstellen/aktualisieren
  async saveCategory(category) {
    const method = category.isNew ? 'POST' : 'PUT';
    const url = category.isNew 
      ? `${this.baseUrl}/categories` 
      : `${this.baseUrl}/categories/${category.id}`;
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: category.id,
        name: category.name
      })
    });
    
    if (!response.ok) throw new Error('Fehler beim Speichern der Kategorie');
    return await response.json();
  },
  
  // Kategorie löschen
  async deleteCategory(id) {
    const response = await fetch(`${this.baseUrl}/categories/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Fehler beim Löschen der Kategorie');
    }
    
    return await response.json();
  },
  
  // Alle Berufe abrufen
  async getProfessions() {
    const response = await fetch(`${this.baseUrl}/professions`);
    if (!response.ok) throw new Error('Fehler beim Laden der Berufe');
    return await response.json();
  },
  
  // Einzelnen Beruf abrufen
  async getProfession(id) {
    const response = await fetch(`${this.baseUrl}/professions/${id}`);
    if (!response.ok) throw new Error('Fehler beim Laden des Berufs');
    return await response.json();
  },
  
  // Beruf speichern
  async saveProfession(profession) {
    const response = await fetch(`${this.baseUrl}/professions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: profession.id,
        title: profession.title,
        description: profession.description,
        duration: profession.duration,
        category_id: profession.category,
        has_knowledge_test: profession.has_knowledge_test,
        requirements: profession.requirements,
        career_options: profession.career_options,
        locations: profession.locations
      })
    });
    
    if (!response.ok) throw new Error('Fehler beim Speichern des Berufs');
    return await response.json();
  },
  
  // Beruf löschen
  async deleteProfession(id) {
    const response = await fetch(`${this.baseUrl}/professions/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Fehler beim Löschen des Berufs');
    return await response.json();
  },
  
  // Bild/QR-Code hochladen
  async uploadImage(professionId, file, altText, isQrCode = false) {
    const formData = new FormData();
    formData.append('file', file);
    if (altText) formData.append('alt_text', altText);
    
    const endpoint = isQrCode ? 
      `${this.baseUrl}/professions/${professionId}/images/qr` : 
      `${this.baseUrl}/professions/${professionId}/images`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
      throw new Error(errorData.error || 'Fehler beim Hochladen des Bildes');
    }
    
    const result = await response.json();
    
    // Service Worker benachrichtigen, um das neue Bild zu cachen
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_NEW_IMAGE',
        url: result.url || result.imageUrl
      });
    }
    
    return result;
  },

  // QR-Code löschen
  async deleteQrCode(professionId) {
    const response = await fetch(`${this.baseUrl}/professions/${professionId}/qr-code`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Fehler beim Löschen des QR-Codes');
    return await response.json();
  },
  
  // Bild löschen
  async deleteImage(id) {
    const response = await fetch(`${this.baseUrl}/gallery-images/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Fehler beim Löschen des Bildes');
    return await response.json();
  }
};

cmsApi.saveQuizQuestions = async function(professionId, questions) {
  const response = await fetch(`${this.baseUrl}/professions/${professionId}/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions })
  });
  
  if (!response.ok) throw new Error('Fehler beim Speichern der Wissenstest-Fragen');
  return await response.json();
};

cmsApi.getQuizQuestions = async function(professionId) {
  const response = await fetch(`${this.baseUrl}/professions/${professionId}/quiz`);
  if (!response.ok) {
      if (response.status === 404) {
          return []; // Kein Wissenstest gefunden
      }
      throw new Error('Fehler beim Laden der Wissenstest-Fragen');
  }
  return await response.json();
};