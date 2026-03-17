import express from 'express';
import session from 'express-session';
import cors from 'cors';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true
  }
});

const userSockets = new Map<number, string>();

io.on('connection', (socket) => {
  const token = socket.handshake.auth.token;
  if (token) {
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: number };
    if (session) {
      userSockets.set(session.user_id, socket.id);
      console.log(`[WS] User ${session.user_id} connected`);
    }
  }

  socket.on('disconnect', () => {
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
  });
});

const PORT = 3000;

app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ['Content-Type', 'X-Session-Token']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(session({
  secret: 'company-cam-clone-secret',
  resave: false,
  saveUninitialized: false,
  proxy: true, // Required for secure cookies behind a proxy
  cookie: {
    secure: true,      // Required for SameSite=None
    sameSite: 'none',  // Required for cross-origin iframe
    httpOnly: true,    // Security best practice
    maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
  }
}));

// Setup Database
const db = new Database('app.db');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL, -- 'admin' or 'tech'
    password TEXT NOT NULL,
    google_calendar_id TEXT,
    hourly_rate REAL DEFAULT 0
  );
`);

// Migration: Add hourly_rate to users if it doesn't exist
try {
  db.exec('ALTER TABLE users ADD COLUMN hourly_rate REAL DEFAULT 0');
} catch (e) {
  // Column probably already exists
}

// Migration: Add job_site_id to jobs if it doesn't exist
try {
  db.exec('ALTER TABLE jobs ADD COLUMN job_site_id INTEGER');
} catch (e) {
  // Column probably already exists
}

// Create job_sites table
db.exec(`
  CREATE TABLE IF NOT EXISTS job_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'New',
    priority TEXT DEFAULT 'Medium',
    assigned_to INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    job_site_id INTEGER,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (job_site_id) REFERENCES job_sites(id)
  );

  CREATE TABLE IF NOT EXISTS job_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT 0,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS job_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    tech_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    time_on_site TEXT NOT NULL,
    time_off_site TEXT,
    notes TEXT,
    materials_used TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    FOREIGN KEY (tech_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    drive_file_id TEXT,
    drive_url TEXT,
    local_path TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS photo_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (photo_id) REFERENCES photos(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    job_id INTEGER, -- Nullable for standalone invoices
    amount REAL NOT NULL,
    status TEXT DEFAULT 'Draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit_price REAL NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );

  CREATE TABLE IF NOT EXISTS estimates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    job_id INTEGER,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'Draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS estimate_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estimate_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit_price REAL NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (estimate_id) REFERENCES estimates(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    google_tokens TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

try {
  db.exec('ALTER TABLE job_updates ADD COLUMN location TEXT');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE jobs ADD COLUMN status TEXT DEFAULT "New"');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE jobs ADD COLUMN customer_id INTEGER REFERENCES customers(id)');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE jobs ADD COLUMN priority TEXT DEFAULT "Medium"');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE job_updates ADD COLUMN time_off_site TEXT');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE invoices ADD COLUMN drive_url TEXT');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE estimates ADD COLUMN drive_url TEXT');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE invoices ADD COLUMN public_token TEXT');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE estimates ADD COLUMN public_token TEXT');
} catch (e) { /* ignore if exists */ }

// Populate missing public_tokens
const invoicesWithoutToken = db.prepare('SELECT id FROM invoices WHERE public_token IS NULL').all() as { id: number }[];
for (const inv of invoicesWithoutToken) {
  const token = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE invoices SET public_token = ? WHERE id = ?').run(token, inv.id);
}

const estimatesWithoutToken = db.prepare('SELECT id FROM estimates WHERE public_token IS NULL').all() as { id: number }[];
for (const est of estimatesWithoutToken) {
  const token = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE estimates SET public_token = ? WHERE id = ?').run(token, est.id);
}

try {
  db.exec('ALTER TABLE jobs ADD COLUMN assigned_to INTEGER REFERENCES users(id)');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE jobs ADD COLUMN scheduled_date TEXT');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE jobs ADD COLUMN job_type TEXT');
} catch (e) { /* ignore if exists */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS job_assignments (
    job_id INTEGER NOT NULL,
    tech_id INTEGER NOT NULL,
    PRIMARY KEY (job_id, tech_id),
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    FOREIGN KEY (tech_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    hst_number TEXT,
    payment_info TEXT,
    google_drive_tokens TEXT,
    google_calendar_tokens TEXT,
    app_icon_url TEXT
  );
`);

try {
  db.exec('ALTER TABLE users ADD COLUMN google_calendar_id TEXT');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE settings ADD COLUMN google_calendar_tokens TEXT');
} catch (e) { /* ignore if exists */ }

try {
  db.exec('ALTER TABLE settings ADD COLUMN app_icon_url TEXT');
} catch (e) { /* ignore if exists */ }

try {
  const tableInfo = db.prepare("PRAGMA table_info(photos)").all() as any[];
  const driveFileIdCol = tableInfo.find(c => c.name === 'drive_file_id');
  
  // If drive_file_id is NOT NULL (notnull === 1), we need to migrate the table
  if (driveFileIdCol && driveFileIdCol.notnull === 1) {
    console.log('Migrating photos table to make drive columns nullable...');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE photos_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id INTEGER NOT NULL,
          drive_file_id TEXT,
          drive_url TEXT,
          local_path TEXT,
          FOREIGN KEY (job_id) REFERENCES jobs(id)
        );
      `);
      db.exec(`
        INSERT INTO photos_new (id, job_id, drive_file_id, drive_url, local_path)
        SELECT id, job_id, drive_file_id, drive_url, local_path FROM photos;
      `);
      db.exec(`DROP TABLE photos;`);
      db.exec(`ALTER TABLE photos_new RENAME TO photos;`);
    })();
  }
} catch (e) { 
  console.error('Migration error for photos table:', e);
}

try {
  db.exec('ALTER TABLE photos ADD COLUMN local_path TEXT');
} catch (e) { /* ignore if exists */ }

// Initialize default settings if not exists
const existingSettings = db.prepare('SELECT id FROM settings WHERE id = 1').get();
if (!existingSettings) {
  db.prepare(`
    INSERT INTO settings (id, company_name, address, phone, email, hst_number, payment_info)
    VALUES (1, 'Central Electrical Solutions Inc.', '25 Goose Creek Drive, Fairview, Prince Edward Island C0A 1H2', '902-218-5648', 'info@centralelectrical.ca', '', 'E-transfers can be sent to pay@centralelectrical.ca')
  `).run();
}

// Ensure a "General Shift" job exists for non-job specific time entries
let generalJob = db.prepare("SELECT id FROM jobs WHERE customer_name = 'General Shift'").get() as { id: number } | undefined;
if (!generalJob) {
  const result = db.prepare("INSERT INTO jobs (customer_name, address, phone, notes, status) VALUES ('General Shift', 'N/A', 'N/A', 'Used for general time logging', 'In Progress')").run();
  generalJob = { id: Number(result.lastInsertRowid) };
}
const GENERAL_JOB_ID = generalJob.id;

// Migrate existing assigned_to to job_assignments
try {
  db.exec(`
    INSERT OR IGNORE INTO job_assignments (job_id, tech_id)
    SELECT id, assigned_to FROM jobs WHERE assigned_to IS NOT NULL;
  `);
} catch (e) { console.error('Migration error:', e); }

// Set starting invoice number
try {
  db.exec("INSERT OR IGNORE INTO sqlite_sequence (name, seq) VALUES ('invoices', 2300)");
} catch (e) { /* ignore */ }

// Seed initial users if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (username, role, password) VALUES (?, ?, ?)');
  insertUser.run('admin', 'admin', 'password');
  insertUser.run('tech1', 'tech', 'password');
  insertUser.run('tech2', 'tech', 'password');
}

try {
  db.exec('ALTER TABLE sessions ADD COLUMN google_tokens TEXT');
} catch (e) { /* ignore if exists */ }

// Setup Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Google OAuth Setup
const redirectUri = `${process.env.APP_URL?.replace(/\/$/, '')}/api/auth/google/callback`;
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  redirectUri
);

async function getOrCreateDriveFolder(drive: any, pathSegments: string[]) {
  let parentId = 'root';
  for (const folderName of pathSegments) {
    const resList = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false and '${parentId}' in parents`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    if (resList.data.files && resList.data.files.length > 0) {
      parentId = resList.data.files[0].id as string;
    } else {
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      };
      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id'
      });
      parentId = folder.data.id as string;
    }
  }
  return parentId;
}

// --- API Routes ---

// Public API Routes (No Auth Required)
app.get('/api/public/invoice/:token', (req, res) => {
  const token = req.params.token;
  const invoice = db.prepare(`
    SELECT i.*, c.name as customer_name, c.address as customer_address, c.phone as customer_phone, c.email as customer_email,
           j.address as job_address, j.notes as job_notes
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN jobs j ON i.job_id = j.id
    WHERE i.public_token = ?
  `).get(token) as any;

  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

  const items = db.prepare(`
    SELECT * FROM invoice_items WHERE invoice_id = ?
  `).all(invoice.id);

  res.json({ ...invoice, items });
});

app.get('/api/public/estimate/:token', (req, res) => {
  const token = req.params.token;
  const estimate = db.prepare(`
    SELECT e.*, c.name as customer_name, c.address as customer_address, c.phone as customer_phone, c.email as customer_email,
           j.address as job_address
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    LEFT JOIN jobs j ON e.job_id = j.id
    WHERE e.public_token = ?
  `).get(token) as any;

  if (!estimate) return res.status(404).json({ message: 'Estimate not found' });

  const items = db.prepare(`
    SELECT * FROM estimate_items WHERE estimate_id = ?
  `).all(estimate.id);

  res.json({ ...estimate, items });
});

app.post('/api/public/estimate/:token/accept', (req, res) => {
  const token = req.params.token;
  const estimate = db.prepare('SELECT * FROM estimates WHERE public_token = ?').get(token) as any;
  
  if (!estimate) return res.status(404).json({ message: 'Estimate not found' });
  if (estimate.status === 'Accepted') return res.status(400).json({ message: 'Estimate already accepted' });

  db.prepare('UPDATE estimates SET status = ? WHERE id = ?').run('Accepted', estimate.id);
  
  // Create a notification for the admin
  db.prepare(`
    INSERT INTO notifications (user_id, type, content, link)
    SELECT id, 'estimate_accepted', ?, ?
    FROM users WHERE role = 'admin'
  `).run(`Estimate #${estimate.id} was accepted by the customer`, `/admin`);

  res.json({ success: true });
});

app.post('/api/public/estimate/:token/decline', (req, res) => {
  const token = req.params.token;
  const estimate = db.prepare('SELECT * FROM estimates WHERE public_token = ?').get(token) as any;
  
  if (!estimate) return res.status(404).json({ message: 'Estimate not found' });
  if (estimate.status === 'Declined') return res.status(400).json({ message: 'Estimate already declined' });

  db.prepare('UPDATE estimates SET status = ? WHERE id = ?').run('Declined', estimate.id);
  
  // Create a notification for the admin
  db.prepare(`
    INSERT INTO notifications (user_id, type, content, link)
    SELECT id, 'estimate_declined', ?, ?
    FROM users WHERE role = 'admin'
  `).run(`Estimate #${estimate.id} was declined by the customer`, `/admin`);

  res.json({ success: true });
});

// Serve uploaded files
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware to handle both Session and Token auth
app.use(async (req, res, next) => {
  const token = req.headers['x-session-token'] as string;
  if (token) {
    try {
      const session = db.prepare('SELECT user_id, google_tokens FROM sessions WHERE token = ?').get(token) as { user_id: number, google_tokens: string };
      if (session) {
        const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(session.user_id) as any;
        if (user) {
          (req as any).user = user;
          if (session.google_tokens) {
            (req as any).googleTokens = JSON.parse(session.google_tokens);
          }
          return next();
        } else {
          console.log(`[AUTH] User ${session.user_id} not found for token`);
        }
      } else {
        console.log(`[AUTH] Session not found for token: ${token.substring(0, 8)}...`);
      }
    } catch (error) {
      console.error('[AUTH] Session middleware error:', error);
    }
  }
  
  // Fallback to express-session for backward compatibility/OAuth
  if ((req.session as any).user) {
    (req as any).user = (req.session as any).user;
    (req as any).googleTokens = (req.session as any).googleTokens;
  }
  next();
});

// Helper to get current user and tokens
const getCurrentUser = (req: express.Request) => (req as any).user;
const getGoogleTokens = (req: express.Request) => (req as any).googleTokens;

// Auth
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as any;
  if (user) {
    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    
    const userData = { id: user.id, username: user.username, role: user.role };
    (req.session as any).user = userData;
    
    console.log(`[AUTH] Login successful for ${user.username}, token: ${token.substring(0, 8)}...`);
    res.json({ success: true, user: userData, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['x-session-token'] as string;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  const user = getCurrentUser(req);
  if (user) {
    res.json({ user });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

// Google OAuth
app.get('/api/auth/google/url', (req, res) => {
  const { company, calendar } = req.query;
  let state = 'user';
  if (company === 'true') state = 'company';
  if (calendar === 'true') state = 'calendar';
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    prompt: 'consent',
    state
  });
  res.json({ url });
});

app.get(['/api/auth/google/callback', '/api/auth/google/callback/'], async (req, res) => {
  const { code, state } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    
    if (state === 'company') {
      db.prepare('UPDATE settings SET google_drive_tokens = ? WHERE id = 1').run(JSON.stringify(tokens));
    } else if (state === 'calendar') {
      db.prepare('UPDATE settings SET google_calendar_tokens = ? WHERE id = 1').run(JSON.stringify(tokens));
    } else {
      (req.session as any).googleTokens = tokens;
      const user = getCurrentUser(req);
      if (user) {
        db.prepare('UPDATE sessions SET google_tokens = ? WHERE user_id = ?').run(JSON.stringify(tokens), user.id);
      }
    }
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', state: '${state}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/auth/google/status', (req, res) => {
  const userTokens = !!getGoogleTokens(req);
  const settings = db.prepare('SELECT google_drive_tokens, google_calendar_tokens FROM settings WHERE id = 1').get() as any;
  const companyConnected = !!settings?.google_drive_tokens;
  const calendarConnected = !!settings?.google_calendar_tokens;
  
  res.json({ 
    connected: userTokens,
    companyConnected,
    calendarConnected
  });
});

// Google Calendar Routes
app.get('/api/google/calendars', async (req, res) => {
  const settings = db.prepare('SELECT google_calendar_tokens FROM settings WHERE id = 1').get() as any;
  if (!settings?.google_calendar_tokens) {
    return res.status(400).json({ error: 'Google Calendar not connected' });
  }

  try {
    const tokens = JSON.parse(settings.google_calendar_tokens);
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.calendarList.list();
    res.json(response.data.items);
  } catch (error) {
    console.error('Error listing calendars:', error);
    res.status(500).json({ error: 'Failed to list calendars' });
  }
});

app.put('/api/users/:id/calendar', (req, res) => {
  const { id } = req.params;
  const { calendar_id } = req.body;
  db.prepare('UPDATE users SET google_calendar_id = ? WHERE id = ?').run(calendar_id, id);
  res.json({ success: true });
});

// Users
app.get('/api/users/techs', (req, res) => {
  const techs = db.prepare('SELECT id, username FROM users WHERE role = ?').all('tech');
  res.json(techs);
});

app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, username, role, google_calendar_id, hourly_rate FROM users').all();
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { username, password, role, hourly_rate } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required' });
  }
  
  try {
    const result = db.prepare('INSERT INTO users (username, password, role, hourly_rate) VALUES (?, ?, ?, ?)').run(username, password, role, hourly_rate || 0);
    const newUser = db.prepare('SELECT id, username, role, hourly_rate FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newUser);
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { username, password, role, hourly_rate } = req.body;
  
  if (!username || !role) {
    return res.status(400).json({ error: 'Username and role are required' });
  }

  try {
    if (password) {
      db.prepare('UPDATE users SET username = ?, password = ?, role = ?, hourly_rate = ? WHERE id = ?').run(username, password, role, hourly_rate || 0, id);
    } else {
      db.prepare('UPDATE users SET username = ?, role = ?, hourly_rate = ? WHERE id = ?').run(username, role, hourly_rate || 0, id);
    }
    const updatedUser = db.prepare('SELECT id, username, role, hourly_rate FROM users WHERE id = ?').get(id);
    res.json(updatedUser);
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
});

app.get('/api/payroll', (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Unauthorized' });

  const { start_date, end_date } = req.query;
  
  let query = `
    SELECT ju.*, u.username, u.hourly_rate, j.customer_name
    FROM job_updates ju
    JOIN users u ON ju.tech_id = u.id
    LEFT JOIN jobs j ON ju.job_id = j.id
    WHERE ju.time_off_site IS NOT NULL
  `;
  const params: any[] = [];

  if (start_date) {
    query += ` AND ju.date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND ju.date <= ?`;
    params.push(end_date);
  }

  const updates = db.prepare(query).all(params) as any[];
  
  const payroll: { [key: number]: any } = {};

  updates.forEach(update => {
    const techId = update.tech_id;
    if (!payroll[techId]) {
      payroll[techId] = {
        tech_id: techId,
        username: update.username,
        hourly_rate: update.hourly_rate || 0,
        total_hours: 0,
        total_pay: 0,
        updates: []
      };
    }

    // Calculate hours
    try {
      const start = new Date(`${update.date}T${update.time_on_site}`);
      const end = new Date(`${update.date}T${update.time_off_site}`);
      let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      if (diff < 0) diff += 24; // Handle overnight shifts

      payroll[techId].total_hours += diff;
      payroll[techId].total_pay += diff * (update.hourly_rate || 0);
      payroll[techId].updates.push(update);
    } catch (e) {
      console.error('Error calculating hours for update:', update.id, e);
    }
  });

  res.json(Object.values(payroll));
});

app.get('/api/my-payroll', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const { start_date, end_date } = req.query;
  
  let query = `
    SELECT ju.*, u.username, u.hourly_rate, j.customer_name
    FROM job_updates ju
    JOIN users u ON ju.tech_id = u.id
    LEFT JOIN jobs j ON ju.job_id = j.id
    WHERE ju.tech_id = ? AND ju.time_off_site IS NOT NULL
  `;
  const params: any[] = [user.id];

  if (start_date) {
    query += ` AND ju.date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND ju.date <= ?`;
    params.push(end_date);
  }

  const updates = db.prepare(query).all(params) as any[];
  
  let total_hours = 0;
  let total_pay = 0;
  const user_data = db.prepare('SELECT hourly_rate FROM users WHERE id = ?').get(user.id) as { hourly_rate: number };

  updates.forEach(update => {
    try {
      const start = new Date(`${update.date}T${update.time_on_site}`);
      const end = new Date(`${update.date}T${update.time_off_site}`);
      let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;
      
      total_hours += diff;
      total_pay += diff * (user_data?.hourly_rate || 0);
    } catch (e) {
      console.error('Error calculating hours for update:', update.id, e);
    }
  });

  res.json({
    tech_id: user.id,
    username: user.username,
    hourly_rate: user_data?.hourly_rate || 0,
    total_hours,
    total_pay,
    updates
  });
});

app.post('/api/shifts', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const { date, time_on_site, time_off_site, notes, job_id, location } = req.body;
  
  if (!date || !time_on_site || !time_off_site) {
    return res.status(400).json({ error: 'Date, time on, and time off are required' });
  }

  const targetJobId = job_id || GENERAL_JOB_ID;

  try {
    const result = db.prepare(`
      INSERT INTO job_updates (job_id, tech_id, date, time_on_site, time_off_site, notes, location)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(targetJobId, user.id, date, time_on_site, time_off_site, notes || 'Shift submitted via payroll tab', location);
    
    // Add calendar event
    try {
      const job = db.prepare('SELECT customer_name FROM jobs WHERE id = ?').get(targetJobId) as { customer_name: string } | undefined;
      const customerName = job ? job.customer_name : 'Unknown Customer';
      
      const userSettings = db.prepare('SELECT google_calendar_id FROM users WHERE id = ?').get(user.id) as { google_calendar_id: string | null } | undefined;
      const calendarId = userSettings?.google_calendar_id;

      const settings = db.prepare('SELECT google_calendar_tokens FROM settings WHERE id = 1').get() as { google_calendar_tokens: string | null } | undefined;
      const tokens = settings?.google_calendar_tokens ? JSON.parse(settings.google_calendar_tokens) : null;

      if (calendarId && tokens) {
        oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        // Parse date and times
        const startDateTime = new Date(`${date}T${time_on_site}:00`).toISOString();
        const endDateTime = new Date(`${date}T${time_off_site}:00`).toISOString();
        
        await calendar.events.insert({
          calendarId: calendarId,
          requestBody: {
            summary: `Shift - ${customerName}`,
            description: notes || 'Shift submitted via payroll tab',
            start: { dateTime: startDateTime },
            end: { dateTime: endDateTime },
          }
        });
      }
    } catch (e) {
      console.error('Failed to add calendar event:', e);
      // Don't fail the shift submission if calendar event fails
    }
    
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Failed to submit shift:', error);
    res.status(500).json({ error: 'Failed to submit shift' });
  }
});

app.put('/api/shifts/:id', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const { id } = req.params;
  const { date, time_on_site, time_off_site, notes, job_id, location } = req.body;
  
  if (!date || !time_on_site || !time_off_site) {
    return res.status(400).json({ error: 'Date, time on, and time off are required' });
  }

  const targetJobId = job_id || GENERAL_JOB_ID;

  try {
    // Check if user owns the shift or is admin
    const shift = db.prepare('SELECT tech_id FROM job_updates WHERE id = ?').get(id) as { tech_id: number } | undefined;
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    
    if (shift.tech_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.prepare(`
      UPDATE job_updates 
      SET job_id = ?, date = ?, time_on_site = ?, time_off_site = ?, notes = ?, location = ?
      WHERE id = ?
    `).run(targetJobId, date, time_on_site, time_off_site, notes, location, id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update shift:', error);
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

app.delete('/api/shifts/:id', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const { id } = req.params;

  try {
    // Check if user owns the shift or is admin
    const shift = db.prepare('SELECT tech_id FROM job_updates WHERE id = ?').get(id) as { tech_id: number } | undefined;
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    
    if (shift.tech_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.prepare('DELETE FROM job_updates WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete shift:', error);
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  
  // Prevent deleting the last admin
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin') as { count: number };
  const userToDelete = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string };
  
  if (userToDelete && userToDelete.role === 'admin' && adminCount.count <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last admin user' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

// Customers
app.get('/api/customers', (req, res) => {
  const customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
  res.json(customers);
});

app.get('/api/customers/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

app.post('/api/customers', (req, res) => {
  const { name, address, phone, email } = req.body;
  const info = db.prepare('INSERT INTO customers (name, address, phone, email) VALUES (?, ?, ?, ?)').run(name, address, phone, email);
  res.json({ id: info.lastInsertRowid });
});

app.get('/api/customers/:id/jobs', (req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs WHERE customer_id = ? OR customer_name = (SELECT name FROM customers WHERE id = ?) ORDER BY created_at DESC').all(req.params.id, req.params.id);
  res.json(jobs);
});

app.get('/api/customers/:id/invoices', (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(invoices);
});

app.get('/api/customers/:id/estimates', (req, res) => {
  const estimates = db.prepare('SELECT * FROM estimates WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(estimates);
});

app.get('/api/customers/:id/job-sites', (req, res) => {
  const jobSites = db.prepare('SELECT * FROM job_sites WHERE customer_id = ?').all(req.params.id);
  res.json(jobSites);
});

app.post('/api/job-sites', (req, res) => {
  const { customer_id, name, address } = req.body;
  const stmt = db.prepare('INSERT INTO job_sites (customer_id, name, address) VALUES (?, ?, ?)');
  const info = stmt.run(customer_id, name, address);
  res.json({ success: true, id: info.lastInsertRowid });
});

// Jobs
app.get('/api/jobs', (req, res) => {
  const status = req.query.status as string;
  const techId = req.query.tech_id as string;
  
  let query = `
    SELECT jobs.*, 
      (SELECT group_concat(users.username, ', ') 
       FROM job_assignments 
       JOIN users ON job_assignments.tech_id = users.id 
       WHERE job_assignments.job_id = jobs.id) as assigned_to_names,
      (SELECT group_concat(tech_id, ',')
       FROM job_assignments
       WHERE job_assignments.job_id = jobs.id) as assigned_tech_ids
    FROM jobs 
    WHERE customer_name != 'General Shift'
  `;
  const params: any[] = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  } else {
    query += " AND status != 'Completed'"; // Default to open jobs
  }
  
  if (techId) {
    query += ` AND (
      EXISTS (SELECT 1 FROM job_assignments WHERE job_assignments.job_id = jobs.id AND job_assignments.tech_id = ?)
      OR NOT EXISTS (SELECT 1 FROM job_assignments WHERE job_assignments.job_id = jobs.id)
    )`;
    params.push(techId);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const jobs = db.prepare(query).all(...params).map((job: any) => {
    return {
      ...job,
      assigned_to_name: job.assigned_to_names || 'Unassigned',
      assigned_techs: job.assigned_tech_ids ? job.assigned_tech_ids.split(',').map(Number) : []
    };
  });
  res.json(jobs);
});

app.get('/api/jobs/:id', (req, res) => {
  const job = db.prepare(`
    SELECT jobs.*, 
      (SELECT group_concat(users.username, ', ') 
       FROM job_assignments 
       JOIN users ON job_assignments.tech_id = users.id 
       WHERE job_assignments.job_id = jobs.id) as assigned_to_names,
      (SELECT group_concat(tech_id, ',')
       FROM job_assignments
       WHERE job_assignments.job_id = jobs.id) as assigned_tech_ids,
      (SELECT id FROM invoices WHERE job_id = jobs.id LIMIT 1) as invoice_id
    FROM jobs 
    WHERE jobs.id = ?
  `).get(req.params.id) as any;
  
  if (!job) return res.status(404).json({ message: 'Job not found' });
  
  job.assigned_to_name = job.assigned_to_names || 'Unassigned';
  job.assigned_techs = job.assigned_tech_ids ? job.assigned_tech_ids.split(',').map(Number) : [];
  
  const tasks = db.prepare('SELECT * FROM tasks WHERE job_id = ?').all(req.params.id);
  const updates = db.prepare(`
    SELECT u.*, us.username as tech_name 
    FROM job_updates u 
    JOIN users us ON u.tech_id = us.id 
    WHERE u.job_id = ? ORDER BY u.created_at DESC
  `).all(req.params.id);
  const photos = db.prepare('SELECT * FROM photos WHERE job_id = ?').all(req.params.id);
  
  res.json({ ...job, tasks, updates, photos });
});

app.post('/api/jobs', (req, res) => {
  const { customer_name, address, phone, notes, tasks, priority, job_type, assigned_techs, scheduled_date, customer_id } = req.body;
  const user = getCurrentUser(req);
  
  const insertJob = db.prepare('INSERT INTO jobs (customer_name, address, phone, notes, priority, job_type, scheduled_date, customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const info = insertJob.run(customer_name, address, phone, notes, priority || 'Medium', job_type || null, scheduled_date || null, customer_id || null);
  const jobId = info.lastInsertRowid;
  
  // Handle Mentions in notes
  handleMentions(notes, user, Number(jobId), 'job notes');

  if (assigned_techs && Array.isArray(assigned_techs)) {
    const insertAssignment = db.prepare('INSERT INTO job_assignments (job_id, tech_id) VALUES (?, ?)');
    for (const techId of assigned_techs) {
      insertAssignment.run(jobId, techId);
    }
  }
  
  if (tasks && Array.isArray(tasks)) {
    const insertTask = db.prepare('INSERT INTO tasks (job_id, description) VALUES (?, ?)');
    for (const task of tasks) {
      if (task.description && task.description.trim()) {
        insertTask.run(jobId, task.description.trim());
        // Handle Mentions in task description
        handleMentions(task.description.trim(), user, Number(jobId), 'a task');
      }
    }
  }
  
  res.json({ success: true, id: jobId });
});

app.put('/api/jobs/:id', (req, res) => {
  const { customer_name, address, phone, notes, priority, job_type, assigned_techs, status, tasks, scheduled_date } = req.body;
  const jobId = req.params.id;
  const user = getCurrentUser(req);
  
  db.prepare('UPDATE jobs SET customer_name = ?, address = ?, phone = ?, notes = ?, priority = ?, job_type = ?, status = ?, scheduled_date = ? WHERE id = ?')
    .run(customer_name, address, phone, notes, priority, job_type || null, status, scheduled_date || null, jobId);
    
  // Handle Mentions in notes
  handleMentions(notes, user, Number(jobId), 'job notes');

  if (assigned_techs && Array.isArray(assigned_techs)) {
    db.prepare('DELETE FROM job_assignments WHERE job_id = ?').run(jobId);
    const insertAssignment = db.prepare('INSERT INTO job_assignments (job_id, tech_id) VALUES (?, ?)');
    for (const techId of assigned_techs) {
      insertAssignment.run(jobId, techId);
    }
  }
    
  if (tasks && Array.isArray(tasks)) {
    const existingTasks = db.prepare('SELECT id FROM tasks WHERE job_id = ?').all(jobId) as {id: number}[];
    const existingTaskIds = existingTasks.map(t => t.id);
    const incomingTaskIds = tasks.filter(t => t.id).map(t => t.id);
    
    // Delete tasks that are no longer present
    const tasksToDelete = existingTaskIds.filter(id => !incomingTaskIds.includes(id));
    for (const id of tasksToDelete) {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    }
    
    // Update or insert tasks
    const updateTask = db.prepare('UPDATE tasks SET description = ?, is_completed = ? WHERE id = ?');
    const insertTask = db.prepare('INSERT INTO tasks (job_id, description, is_completed) VALUES (?, ?, ?)');
    
    for (const task of tasks) {
      if (task.description && task.description.trim()) {
        if (task.id) {
          updateTask.run(task.description.trim(), task.is_completed ? 1 : 0, task.id);
        } else {
          insertTask.run(jobId, task.description.trim(), task.is_completed ? 1 : 0);
        }
        // Handle Mentions in task description
        handleMentions(task.description.trim(), user, Number(jobId), 'a task');
      }
    }
  }
  
  res.json({ success: true });
});

app.delete('/api/jobs/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE job_id = ?').run(req.params.id);
  db.prepare('DELETE FROM job_updates WHERE job_id = ?').run(req.params.id);
  db.prepare('DELETE FROM photos WHERE job_id = ?').run(req.params.id);
  db.prepare('DELETE FROM job_assignments WHERE job_id = ?').run(req.params.id);
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.patch('/api/jobs/:id/reschedule', (req, res) => {
  const { assigned_techs, scheduled_date } = req.body;
  const jobId = req.params.id;
  
  db.prepare('UPDATE jobs SET scheduled_date = ? WHERE id = ?')
    .run(scheduled_date || null, jobId);
    
  if (assigned_techs && Array.isArray(assigned_techs)) {
    db.prepare('DELETE FROM job_assignments WHERE job_id = ?').run(jobId);
    const insertAssignment = db.prepare('INSERT INTO job_assignments (job_id, tech_id) VALUES (?, ?)');
    for (const techId of assigned_techs) {
      insertAssignment.run(jobId, techId);
    }
  }
    
  res.json({ success: true });
});

app.put('/api/jobs/:id/status', (req, res) => {
  try {
    const status = req.body?.status;
    const user = getCurrentUser(req);
    
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!status) return res.status(400).json({ message: 'Status is required' });
    
    console.log(`Updating job ${req.params.id} status to ${status} by user ${user.username}`);
    
    const result = db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run(status, Number(req.params.id));
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating job status:', error);
    res.status(500).json({ message: error.message || 'Failed to update job status' });
  }
});

app.put('/api/tasks/:id', (req, res) => {
  const { is_completed } = req.body;
  db.prepare('UPDATE tasks SET is_completed = ? WHERE id = ?').run(is_completed ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.post('/api/jobs/:id/tasks', (req, res) => {
  const user = getCurrentUser(req);
  const { description } = req.body;
  const insertTask = db.prepare('INSERT INTO tasks (job_id, description) VALUES (?, ?)');
  const info = insertTask.run(req.params.id, description);
  
  // Handle Mentions
  handleMentions(description, user, Number(req.params.id), 'a task');
  
  res.json({ success: true, id: info.lastInsertRowid });
});

app.get('/api/photos', (req, res) => {
  const photos = db.prepare(`
    SELECT p.*, j.customer_name, j.created_at as job_created_at
    FROM photos p
    JOIN jobs j ON p.job_id = j.id
    ORDER BY p.id DESC
  `).all();
  res.json(photos);
});

// Job Updates & Photos
app.post('/api/jobs/:id/updates', upload.array('photos'), async (req, res) => {
  const jobId = req.params.id;
  const { date, time_on_site, time_off_site, notes, materials_used, submit } = req.body;
  const user = getCurrentUser(req);
  
  // Try to get company tokens first, fall back to user tokens
  const settings = db.prepare('SELECT google_drive_tokens FROM settings WHERE id = 1').get() as any;
  const companyTokens = settings?.google_drive_tokens ? JSON.parse(settings.google_drive_tokens) : null;
  const userTokens = getGoogleTokens(req);
  
  const tokens = companyTokens || userTokens;
  
  console.log(`Received update for job ${jobId} from user ${user?.username}. Using ${companyTokens ? 'company' : 'user'} tokens.`);
  
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(Number(jobId)) as any;
  if (!job) return res.status(404).json({ message: 'Job not found' });

  // 1. Save Update to DB
  const insertUpdate = db.prepare(`
    INSERT INTO job_updates (job_id, tech_id, date, time_on_site, time_off_site, notes, materials_used)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertUpdate.run(Number(jobId), user.id, date, time_on_site, time_off_site, notes, materials_used);

  // Handle Mentions
  handleMentions(notes, user, Number(jobId), 'a job update');
  handleMentions(materials_used, user, Number(jobId), 'materials used');

  // 2. Handle Photos
  const files = req.files as Express.Multer.File[];
  const uploadedPhotoLinks: string[] = [];
  if (files && files.length > 0) {
    const insertPhoto = db.prepare('INSERT INTO photos (job_id, local_path) VALUES (?, ?)');
    const updatePhotoDrive = db.prepare('UPDATE photos SET drive_file_id = ?, drive_url = ? WHERE id = ?');
    
    for (const file of files) {
      const localPath = `/uploads/${file.filename}`;
      const photoResult = insertPhoto.run(Number(jobId), localPath);
      const photoId = photoResult.lastInsertRowid;
      
      if (tokens) {
        try {
          const driveOauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
          );
          driveOauth2Client.setCredentials(tokens);
          const drive = google.drive({ version: 'v3', auth: driveOauth2Client });
          
          // Find or create folder for customer
          const folderId = await getOrCreateDriveFolder(drive, ['customers', job.customer_name]);
          
          const fileMetadata = {
            name: file.originalname,
            parents: [folderId as string]
          };
          const media = {
            mimeType: file.mimetype,
            body: fs.createReadStream(file.path)
          };
          
          const uploadedFile = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink'
          });
          
          updatePhotoDrive.run(uploadedFile.data.id, uploadedFile.data.webViewLink, photoId);
          if (uploadedFile.data.webViewLink) {
            uploadedPhotoLinks.push(uploadedFile.data.webViewLink);
          }
          
          // We keep the local file as a backup/fallback for now, 
          // but you could unlink it here if you want to save space and only use Drive.
          // fs.unlinkSync(file.path);
        } catch (error) {
          console.error('Error uploading to Drive:', error);
        }
      }
    }
  }

  // 3. Handle Calendar Event if submitted
  if (submit === 'true') {
    const calendarSettings = db.prepare('SELECT google_calendar_tokens FROM settings WHERE id = 1').get() as any;
    const tech = db.prepare('SELECT google_calendar_id FROM users WHERE id = ?').get(user.id) as any;

    if (calendarSettings?.google_calendar_tokens && tech?.google_calendar_id) {
      const calOauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );
      calOauth2Client.setCredentials(JSON.parse(calendarSettings.google_calendar_tokens));
      const calendar = google.calendar({ version: 'v3', auth: calOauth2Client });
      
      try {
        // Parse date and time
        const [year, month, day] = date.split('-');
        const [hours, minutes] = time_on_site.split(':');
        
        const startDateTime = new Date(year, month - 1, day, hours, minutes);
        let endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours duration
        
        if (time_off_site) {
          const [endHours, endMinutes] = time_off_site.split(':');
          endDateTime = new Date(year, month - 1, day, endHours, endMinutes);
          if (endDateTime < startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1); // Handle crossing midnight
          }
        }
        
        let description = `Notes: ${notes}\nMaterials: ${materials_used}\nJob Link: ${process.env.APP_URL}/jobs/${jobId}`;
        if (uploadedPhotoLinks.length > 0) {
          description += `\n\nUploaded Photos:\n${uploadedPhotoLinks.join('\n')}`;
        }
        
        const event = {
          summary: `Job: ${job.customer_name} - ${job.job_type}`,
          location: job.address,
          description: description,
          start: {
            dateTime: startDateTime.toISOString(),
          },
          end: {
            dateTime: endDateTime.toISOString(),
          },
        };
        
        await calendar.events.insert({
          calendarId: tech.google_calendar_id,
          requestBody: event,
        });
        console.log(`Calendar event created for tech ${user.username} on calendar ${tech.google_calendar_id}`);
      } catch (error) {
        console.error('Error creating calendar event:', error);
      }
    }
  }

  res.json({ success: true });
});

app.get('/api/jobs/:id/data-for-invoice', async (req, res) => {
  const jobId = req.params.id;
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Unauthorized' });

  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
    const updates = db.prepare('SELECT * FROM job_updates WHERE job_id = ?').all(jobId) as any[];
    
    if (!job) return res.status(404).json({ message: 'Job not found' });

    res.json({ job, updates });
  } catch (error) {
    console.error('Data fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/jobs/:id/work-order', (req, res) => {
  const job = db.prepare(`
    SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
    FROM jobs j
    LEFT JOIN customers c ON j.customer_id = c.id
    WHERE j.id = ?
  `).get(req.params.id);
  
  if (!job) return res.status(404).json({ message: 'Job not found' });
  
  const tasks = db.prepare('SELECT * FROM tasks WHERE job_id = ?').all(req.params.id);
  const updates = db.prepare('SELECT * FROM job_updates WHERE job_id = ? ORDER BY created_at DESC').all(req.params.id);
  const photos = db.prepare('SELECT * FROM photos WHERE job_id = ?').all(req.params.id);
  
  res.json({ ...job, tasks, updates, photos });
});

app.post('/api/invoices', (req, res) => {
  const { customer_id, job_id, amount, items, status } = req.body;
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Unauthorized' });

  try {
    const public_token = crypto.randomBytes(16).toString('hex');
    const insertInvoice = db.prepare(`
      INSERT INTO invoices (customer_id, job_id, amount, status, public_token)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = insertInvoice.run(customer_id, job_id || null, amount, status || 'Draft', public_token);
    const invoiceId = info.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(invoiceId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
    }

    res.json({ id: invoiceId, success: true });
  } catch (error) {
    console.error('Invoice Creation Error:', error);
    res.status(500).json({ message: 'Failed to create invoice' });
  }
});

app.put('/api/invoices/:id', (req, res) => {
  const { amount, items, status } = req.body;
  const { id } = req.params;
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Unauthorized' });

  try {
    db.prepare('UPDATE invoices SET amount = ?, status = ? WHERE id = ?').run(amount, status, id);
    
    // Replace items
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Invoice Update Error:', error);
    res.status(500).json({ message: 'Failed to update invoice' });
  }
});

app.get('/api/invoices/:id', (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, j.address as job_address, j.notes as job_notes
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN jobs j ON i.job_id = j.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

  const items = db.prepare(`
    SELECT * FROM invoice_items WHERE invoice_id = ?
  `).all(req.params.id);

  res.json({ ...invoice, items });
});

app.post('/api/invoices/:id/save-to-drive', async (req, res) => {
  const invoiceId = req.params.id;
  const { pdfBase64 } = req.body;
  const user = getCurrentUser(req);
  
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Unauthorized' });
  if (!pdfBase64) return res.status(400).json({ message: 'PDF content is required' });

  try {
    const invoice = db.prepare(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `).get(invoiceId) as any;

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const settings = db.prepare('SELECT google_drive_tokens FROM settings WHERE id = 1').get() as any;
    const tokens = settings?.google_drive_tokens ? JSON.parse(settings.google_drive_tokens) : null;

    if (!tokens) {
      return res.status(400).json({ message: 'Google Drive is not connected' });
    }

    const driveOauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    driveOauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: driveOauth2Client });

    // Find or create folder for customer
    const folderId = await getOrCreateDriveFolder(drive, ['customers', invoice.customer_name]);

    // Create the document
    const fileMetadata = {
      name: `Invoice #${invoice.id} - ${invoice.customer_name}.pdf`,
      parents: [folderId as string]
    };

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64.split(',')[1], 'base64');
    
    // Use a PassThrough stream for the buffer
    const { PassThrough } = await import('stream');
    const bufferStream = new PassThrough();
    bufferStream.end(pdfBuffer);

    const media = {
      mimeType: 'application/pdf',
      body: bufferStream
    };

    const uploadedFile = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    const driveUrl = uploadedFile.data.webViewLink;
    db.prepare('UPDATE invoices SET drive_url = ? WHERE id = ?').run(driveUrl, invoiceId);

    res.json({ success: true, url: driveUrl });
  } catch (error: any) {
    console.error('Error saving invoice to Drive:', error);
    res.status(500).json({ message: error.message || 'Failed to save to Google Drive' });
  }
});

app.get('/api/customers', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  const customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
  res.json(customers);
});

app.get('/api/invoices', (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Unauthorized' });

  const invoices = db.prepare(`
    SELECT i.*, c.name as customer_name, COALESCE(j.address, c.address) as job_address
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN jobs j ON i.job_id = j.id
    ORDER BY i.created_at DESC
  `).all();
  res.json(invoices);
});

app.get('/api/jobs-without-invoices', (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ message: 'Unauthorized' });

  const jobs = db.prepare(`
    SELECT j.*, c.name as customer_name
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    LEFT JOIN invoices i ON j.id = i.job_id
    WHERE j.status = 'Completed' AND i.id IS NULL
  `).all();
  res.json(jobs);
});

// Estimates API
app.post('/api/estimates', (req, res) => {
  const { customer_id, job_id, amount, items } = req.body;
  const public_token = crypto.randomBytes(16).toString('hex');
  const result = db.prepare('INSERT INTO estimates (customer_id, job_id, amount, public_token) VALUES (?, ?, ?, ?)').run(customer_id, job_id, amount, public_token);
  const estimateId = result.lastInsertRowid;

  const insertItem = db.prepare('INSERT INTO estimate_items (estimate_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)');
  for (const item of items) {
    insertItem.run(estimateId, item.description, item.quantity, item.unit_price, item.amount);
  }

  res.json({ id: estimateId });
});

app.get('/api/estimates', (req, res) => {
  const estimates = db.prepare(`
    SELECT e.*, c.name as customer_name, j.address as job_address 
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    LEFT JOIN jobs j ON e.job_id = j.id
    ORDER BY e.created_at DESC
  `).all();
  res.json(estimates);
});

app.get('/api/estimates/:id', (req, res) => {
  const estimate = db.prepare(`
    SELECT e.*, c.name as customer_name, c.address as customer_address, c.phone as customer_phone, c.email as customer_email, j.address as job_address 
    FROM estimates e
    JOIN customers c ON e.customer_id = c.id
    LEFT JOIN jobs j ON e.job_id = j.id
    WHERE e.id = ?
  `).get(req.params.id);
  
  if (!estimate) return res.status(404).json({ message: 'Estimate not found' });
  
  const items = db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(req.params.id);
  res.json({ ...estimate, items });
});

app.put('/api/estimates/:id', (req, res) => {
  const { amount, status, items } = req.body;
  
  if (status) {
    db.prepare('UPDATE estimates SET status = ? WHERE id = ?').run(status, req.params.id);
  }
  
  if (amount !== undefined) {
    db.prepare('UPDATE estimates SET amount = ? WHERE id = ?').run(amount, req.params.id);
  }

  if (items) {
    db.prepare('DELETE FROM estimate_items WHERE estimate_id = ?').run(req.params.id);
    const insertItem = db.prepare('INSERT INTO estimate_items (estimate_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)');
    for (const item of items) {
      insertItem.run(req.params.id, item.description, item.quantity, item.unit_price, item.amount);
    }
  }

  res.json({ success: true });
});

app.delete('/api/estimates/:id', (req, res) => {
  db.prepare('DELETE FROM estimate_items WHERE estimate_id = ?').run(req.params.id);
  db.prepare('DELETE FROM estimates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/estimates/:id/accept', (req, res) => {
  const estimateId = req.params.id;
  const estimate = db.prepare('SELECT * FROM estimates WHERE id = ?').get(estimateId) as any;
  
  if (!estimate) return res.status(404).json({ message: 'Estimate not found' });
  
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(estimate.customer_id) as any;
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  // Create NEW JOB (Ticket)
  const items = db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(estimateId) as any[];
  const itemsSummary = items.map(i => `${i.description} (Qty: ${i.quantity})`).join('\n');
  const jobNotes = `Job created from accepted Estimate #${estimateId}.\n\nEstimated Work:\n${itemsSummary}`;
  
  const jobResult = db.prepare(`
    INSERT INTO jobs (customer_name, address, phone, notes, status, priority, customer_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(customer.name, customer.address, customer.phone, jobNotes, 'New', 'Medium', customer.id);
  const newJobId = jobResult.lastInsertRowid;

  // Update estimate status and link to the NEW job
  db.prepare("UPDATE estimates SET status = 'Accepted', job_id = ? WHERE id = ?").run(newJobId, estimateId);
  
  // Create invoice from estimate, linked to the NEW job
  const result = db.prepare('INSERT INTO invoices (customer_id, job_id, amount) VALUES (?, ?, ?)').run(estimate.customer_id, newJobId, estimate.amount);
  const invoiceId = result.lastInsertRowid;
  
  const insertInvoiceItem = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)');
  for (const item of items) {
    insertInvoiceItem.run(invoiceId, item.description, item.quantity, item.unit_price, item.amount);
  }
  
  res.json({ invoiceId, jobId: newJobId });
});

// --- Photo Comments & Notifications ---

const sendNotification = (userId: number, type: string, content: string, link: string) => {
  const result = db.prepare('INSERT INTO notifications (user_id, type, content, link) VALUES (?, ?, ?, ?)').run(userId, type, content, link);
  const notificationId = result.lastInsertRowid;
  
  const socketId = userSockets.get(userId);
  if (socketId) {
    io.to(socketId).emit('notification', {
      id: notificationId,
      type,
      content,
      link,
      is_read: 0,
      created_at: new Date().toISOString()
    });
  }
};

const handleMentions = (text: string, currentUser: any, jobId: number, context: string, photoId?: number) => {
  if (!text || !currentUser) return;
  const mentions = text.match(/@(\w+)/g);
  if (mentions) {
    const uniqueMentions = [...new Set(mentions.map((m: string) => m.substring(1)))];
    for (const username of uniqueMentions) {
      const mentionedUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number };
      if (mentionedUser && mentionedUser.id !== currentUser.id) {
        let link = `/job/${jobId}`;
        if (photoId) {
          link += `?photo=${photoId}`;
        }
        sendNotification(
          mentionedUser.id, 
          'mention', 
          `${currentUser.username} mentioned you in ${context}`, 
          link
        );
      }
    }
  }
};

app.get('/api/photos/:id/comments', (req, res) => {
  const comments = db.prepare(`
    SELECT pc.*, u.username 
    FROM photo_comments pc
    JOIN users u ON pc.user_id = u.id
    WHERE pc.photo_id = ?
    ORDER BY pc.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

app.post('/api/photos/:id/comments', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const { text } = req.body;
  const photoId = req.params.id;

  const result = db.prepare('INSERT INTO photo_comments (photo_id, user_id, text) VALUES (?, ?, ?)').run(photoId, user.id, text);
  
  // Handle @mentions
  const photo = db.prepare('SELECT job_id FROM photos WHERE id = ?').get(photoId) as { job_id: number };
  handleMentions(text, user, photo.job_id, 'a photo comment', Number(photoId));

  res.json({ success: true, id: result.lastInsertRowid });
});

app.get('/api/notifications', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(user.id);
  res.json(notifications);
});

app.put('/api/notifications/:id/read', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, user.id);
  res.json({ success: true });
});

// --- Company Chat ---
app.get('/api/messages', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const messages = db.prepare(`
    SELECT m.*, u.username, u.role
    FROM messages m
    JOIN users u ON m.user_id = u.id
    ORDER BY m.created_at ASC
    LIMIT 100
  `).all();
  res.json(messages);
});

app.post('/api/messages', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ message: 'Message text is required' });

  const result = db.prepare('INSERT INTO messages (user_id, text) VALUES (?, ?)').run(user.id, text);
  const messageId = result.lastInsertRowid;

  const newMessage = db.prepare(`
    SELECT m.*, u.username, u.role
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.id = ?
  `).get(messageId);

  // Broadcast to all connected users
  io.emit('chat_message', newMessage);

  res.json(newMessage);
});

// --- Settings ---
app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

  const { company_name, address, phone, email, hst_number, payment_info } = req.body;
  db.prepare(`
    UPDATE settings 
    SET company_name = ?, address = ?, phone = ?, email = ?, hst_number = ?, payment_info = ?
    WHERE id = 1
  `).run(company_name, address, phone, email, hst_number, payment_info);
  
  res.json({ success: true });
});

app.post('/api/settings/logo', upload.single('logo'), (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const logoUrl = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE settings SET logo_url = ? WHERE id = 1').run(logoUrl);
  
  res.json({ success: true, logoUrl });
});

app.post('/api/settings/app-icon', upload.single('icon'), (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const iconUrl = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE settings SET app_icon_url = ? WHERE id = 1').run(iconUrl);
  
  res.json({ success: true, iconUrl });
});

// Serve uploads as static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
