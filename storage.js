// Konvertiert den Zeichnungs-Zustand in einen kompakten URL-Hash
function exportToLink(objects, pixelsPerMeter) {
    const data = {
        ppm: pixelsPerMeter,
        objs: objects
    };
    const jsonString = JSON.stringify(data);
    const encoded = btoa(encodeURIComponent(jsonString)); // Base64 Kodierung
    
    const shareUrl = window.location.origin + window.location.pathname + "#plan=" + encoded;
    
    // In Zwischenablage kopieren
    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("🔗 Link kopiert! Speichere ihn in einer Mail oder Notiz.");
    });
}

// Lädt Daten direkt aus der URL-Adresse beim Öffnen der Seite
function importFromLink() {
    const hash = window.location.hash;
    if (!hash.includes("#plan=")) return null;

    try {
        const encoded = hash.replace("#plan=", "");
        const jsonString = decodeURIComponent(atob(encoded));
        const data = JSON.parse(jsonString);
        showToast("⚡ Entwurf erfolgreich aus Link geladen!");
        return data;
    } catch (e) {
        console.error("Fehler beim Laden des Links", e);
        return null;
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast-msg');
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
}
