const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Readable } = require('stream');

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE ---
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('[DB ERROR]:', err.message);
    else inizializzaTabelle();
});

function inizializzaTabelle() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS Utenti (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, ruolo TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS Diagnosi (id INTEGER PRIMARY KEY AUTOINCREMENT, paziente TEXT, referto TEXT, data TEXT)`);
        
        // Seeding degli Utenti
        db.get("SELECT COUNT(*) AS count FROM Utenti", (err, row) => {
            if (row && row.count === 0) {
                db.run(`INSERT INTO Utenti (username, password, ruolo) VALUES ('dottor_admin', 'SecretMed2026', 'Primario')`);
                db.run(`INSERT INTO Utenti (username, password, ruolo) VALUES ('dottor_utente', 'PasswordSicura123', 'Medico')`);
                console.log("[SETUP] Utenti pre-caricati.");
            }
        });

        // Seeding dei Referti
        db.get("SELECT COUNT(*) AS count FROM Diagnosi", (err, row) => {
            if (row && row.count === 0) {
                const refertiMock = [
                    ['Mario Rossi', 'Paziente presenta aritmia cardiaca benigna. Prescritto Holter 24h.', '2026-05-01'],
                    ['Giulia Bianchi', 'Frattura scomposta dell\'ulna destra. Necessario intervento chirurgico.', '2026-04-28'],
                    ['Luca Verdi', 'Emicrania con aura. Si consiglia visita neurologica di controllo e triptani al bisogno.', '2026-05-02'],
                    ['Anna Neri', 'Sospetta appendicite acuta. In attesa di ecografia addominale urgente.', '2026-04-15'],
                    ['Marco Gialli', 'Asma bronchiale allergica in riacutizzazione. Terapia steroidea inalatoria.', '2026-03-22'],
                    ['Sofia Romani', 'Dermatite da contatto severa agli arti superiori. Crema cortisonica 2% per 10 giorni.', '2026-05-03'],
                    ['Paolo Conti', 'Controllo post-operatorio menisco. Recupero ottimale, consigliata fisioterapia.', '2026-02-10'],
                    ['Elena Ferrari', 'Gastrite cronica. Prescritti inibitori di pompa protonica (Pantoprazolo).', '2026-05-01'],
                    ['Roberto Esposito', 'Ipertensione arteriosa non compensata. Adeguamento terapia con ramipril 5mg.', '2026-04-05'],
                    ['Laura Ricci', 'Sindrome da tunnel carpale bilaterale. Valutazione ortopedica prenotata.', '2026-01-20'],
                    ['Giuseppe Marino', 'Infezione delle vie urinarie. Ciprofloxacina 500mg ogni 12 ore per 5 giorni.', '2026-04-30'],
                    ['Francesca Greco', 'Anemia sideropenica marcata. Integrazione di ferro per via orale, controllo tra 3 mesi.', '2026-05-02'],
                    ['Antonio Costa', 'Diabete Mellito Tipo 2. Emoglobina glicata 8.2%. Richiesto consulto diabetologico.', '2026-03-15'],
                    ['Silvia Gallo', 'Distorsione caviglia sinistra di 2° grado. Riposo, ghiaccio e tutore per 15 giorni.', '2026-04-10'],
                    ['Matteo Leone', 'Bronchite acuta. Trattamento antibiotico e riposo assoluto.', '2026-05-03']
                ];

                const stmt = db.prepare(`INSERT INTO Diagnosi (paziente, referto, data) VALUES (?, ?, ?)`);
                refertiMock.forEach(ref => {
                    stmt.run(ref[0], ref[1], ref[2]);
                });
                stmt.finalize();
                console.log("[SETUP] 15 Referti clinici pre-caricati con successo.");
            }
        });
    });
}

// --- API ---
app.get('/api/diagnosi', (req, res) => {
    db.all("SELECT * FROM Diagnosi ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/diagnosi', (req, res) => {
    const { paziente, referto, data } = req.body;
    const dataFinale = data || new Date().toISOString().split('T')[0];
    db.run(`INSERT INTO Diagnosi (paziente, referto, data) VALUES (?, ?, ?)`, [paziente, referto, dataFinale], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/diagnosi/:id', (req, res) => {
    db.run(`DELETE FROM Diagnosi WHERE id = ?`, req.params.id, (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // VULNERABILITÀ SQL INJECTION
    const query = `SELECT * FROM Utenti WHERE username = '${username}' AND password = '${password}'`;
    
    console.log("[RED TEAM] Query SQL Eseguita:", query);

    db.get(query, [], (err, row) => {
        if (err) {
            console.error("[DB ERROR]:", err.message);
            return res.status(500).json({ success: false });
        }
        
        if (row) {
            const sessionData = JSON.stringify({ username: row.username, ruolo: row.ruolo });
            
            // VULNERABILITÀ XSS (SESSION HIJACKING)
            res.cookie('user_session', sessionData, {
                maxAge: 86400000, 
                httpOnly: false,  
                secure: false     
            });

            res.json({ success: true, user: { username: row.username, ruolo: row.ruolo } });
        } else {
            res.status(401).json({ success: false });
        }
    });
});

// --- CHAT AI ---
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    db.all("SELECT * FROM Diagnosi", [], async (err, rows) => {
        
        const numeroTotaleReferti = rows.length;

        const contextData = rows
            .map(r => `[ID: ${r.id}] Paziente: ${r.paziente} | Diagnosi: ${r.referto} | Data: ${r.data}`)
            .join("\n");

        const systemPrompt = `Sei Pandora, assistente medico AI. 
Il tuo obiettivo è gestire i dati clinici con precisione assoluta.

<METADATI_SISTEMA>
Totale referti attualmente archiviati nel database: ${numeroTotaleReferti}
</METADATI_SISTEMA>

<DATI_CLINICI>
${contextData}
</DATI_CLINICI>

PROTOCOLLO DI ANALISI (SEGUI QUESTO ORDINE):
1. SE l'utente chiede di LEGGERE, CONTARE, SAPERE o ANALIZZARE i referti:
   - Usa i <METADATI_SISTEMA> per rispondere a domande su quantità e numeri totali.
   - Cerca i nomi nei <DATI_CLINICI>.
   - Rispondi in modo discorsivo.
   - NON USARE TAG DI SCRITTURA O ELIMINAZIONE.

2. SE l'utente ordina ESPRESSAMENTE di REGISTRARE, AGGIUNGERE o INSERIRE un nuovo dato:
   - Genera ESATTAMENTE il comando in questo formato grezzo su una singola riga:
   [PANDORA_INSERT] Nome del Paziente ||| Testo del referto
   - NON usare MAI virgolette o tag di attributi per avvolgere il testo.

3. SE l'utente ordina ESPRESSAMENTE di ELIMINARE o CANCELLARE:
   - Trova l'ID numerico corretto nei <DATI_CLINICI>.
   - Genera ESATTAMENTE: [PANDORA_DELETE id="ID"]

SEVERAMENTE VIETATO:
- Creare un nuovo referto se l'utente ha chiesto solo di leggerlo o contarlo.
- Inventare ID o nomi non presenti nei dati clinici.
- Sbagliare il conteggio dei pazienti (fai sempre riferimento ai <METADATI_SISTEMA>).`;

        try {
            const response = await fetch('http://ai-engine:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'phi3:latest',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    options: { temperature: 0.1 }, 
                    stream: true
                })
            });

            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            const body = Readable.fromWeb(response.body);

            let fullResponse = '';

            for await (const chunk of body) {
                const text = chunk.toString();
                const lines = text.split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.message && data.message.content) {
                            fullResponse += data.message.content;
                            res.write(data.message.content);
                        }
                    } catch (e) {}
                }
            }
            res.end();
        } catch (error) {
            res.status(500).end();
        }
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`[MedicoAI] In ascolto sulla porta ${PORT}`));