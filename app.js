// ============================================
// KAS PERUMAHAN - APP LOGIC
// ============================================

// 🔥 SUPABASE CONFIG - EDIT DI SINI SAJA!
const SUPABASE_CONFIG = {
    URL: 'https://syjtzpatlajsvypzmenf.supabase.co',  // ← GANTI DENGAN URL ANDA
    KEY: 'sb_publishable_0iEGc2Ec4m_fMHyz0HoHFg_jyDJTiVn'                      // ← GANTI DENGAN API KEY ANDA
};

const app = {
    // ===== VERSION CONTROL =====
    VERSION: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1.0.0',
    VERSION_KEY: 'app_version',

    // Supabase (langsung dari config di atas)
    supabase: null,
    isConnected: false,

    // Data
    warga: [],
    transaksi: [],
    nextId: parseInt(localStorage.getItem('kasNextId')) || 1,

    // Constants
    namaBulan: ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],
    namaBulanSingkat: ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],

    isConnected: false,
    isAdmin: localStorage.getItem('kasAdminMode') === 'aktif', // A. Ganti logika constructor ke sini
    
    // ===== INIT =====
    init() {
        // Tampilkan versi
        this.showVersion();
        this.checkVersion();

        // Set tanggal default
        document.getElementById('tanggal').valueAsDate = new Date();
        const now = new Date();
        document.getElementById('bulan-iuran').value = now.getMonth() + 1;
        this.generateTahunOptions();

        // Auto-connect Supabase (langsung dari config)
        this.initSupabase();
        this.testConnection();
        this.applyAdminStatus();

        // Register SW
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => {
                    setInterval(() => reg.update(), 60000);
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                this.showUpdateToast();
                            }
                        });
                    });
                })
                .catch(console.error);
        }
    },

    // ===== SUPABASE =====
    initSupabase() {
        try {
            // Sanitasi URL
            let cleanUrl = SUPABASE_CONFIG.URL.trim()
                .replace(/\/$/, '')
                .replace(/\/rest\/v1\/?$/, '');
            
            this.supabase = window.supabase.createClient(cleanUrl, SUPABASE_CONFIG.KEY);
            return true;
        } catch(e) { 
            console.error('Supabase init error:', e);
            return false; 
        }
    },

    async testConnection() {
        this.updateStatus('syncing', '⏳ Menghubungkan ke Supabase...');

        try {
            const { error } = await this.supabase.from('warga').select('count', { count: 'exact' }).limit(1);
            if (error) throw error;

            this.isConnected = true;
            this.updateStatus('online', '✓ Terhubung ke Cloud');
            await this.loadAllData();
        } catch(err) {
            this.isConnected = false;
            this.updateStatus('offline', '❌ ' + err.message);
            this.loadLocal();
        }
    },

    async loadAllData() {
        try {
            const { data: w, error: wErr } = await this.supabase.from('warga').select('*').order('no_rumah');
            const { data: t, error: tErr } = await this.supabase.from('transaksi').select('*').order('tanggal', { ascending: false });

            if (wErr) throw wErr;
            if (tErr) throw tErr;

            this.warga = w || [];
            this.transaksi = t || [];

            this.updateWargaDropdown();
            this.renderDashboard();
            this.renderListTransaksi();
            this.renderListWarga();
        } catch(err) {
            console.error('Load data error:', err);
            this.loadLocal();
        }
    },

    // ===== LOCAL STORAGE =====
    loadLocal() {
        this.warga = JSON.parse(localStorage.getItem('kasWarga')) || [];
        this.transaksi = JSON.parse(localStorage.getItem('kasTransaksi')) || [];
        this.updateWargaDropdown();
        this.renderDashboard();
    },

    saveLocal() {
        localStorage.setItem('kasWarga', JSON.stringify(this.warga));
        localStorage.setItem('kasTransaksi', JSON.stringify(this.transaksi));
        localStorage.setItem('kasNextId', this.nextId);
    },

    // ===== VERSION CONTROL =====
    showVersion() {
        const v = document.getElementById('version-display');
        const av = document.getElementById('app-version');
        if (v) v.textContent = 'v' + this.VERSION;
        if (av) av.textContent = this.VERSION;
    },

    checkVersion() {
        const saved = localStorage.getItem(this.VERSION_KEY);
        if (saved && saved !== this.VERSION) {
            this.showUpdateToast();
        }
        localStorage.setItem(this.VERSION_KEY, this.VERSION);
    },

    showUpdateToast() {
        const toast = document.getElementById('update-toast');
        if (toast) toast.classList.remove('hidden');
    },

    async checkUpdate() {
        const btn = event.target;
        btn.textContent = '⏳...';
        btn.disabled = true;

        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
            
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(reg => reg.unregister()));
            
            alert('✅ Update diterapkan! Halaman akan dimuat ulang.');
            location.reload(true);
        } catch(err) {
            alert('❌ Gagal: ' + err.message);
            btn.textContent = '🔄 Cek Update';
            btn.disabled = false;
        }
    },

    // ===== UI HELPERS =====
    formatRp(n) {
        if (!n && n !== 0) return 'Rp0';
        return 'Rp' + n.toLocaleString('id-ID');
    },

    updateStatus(type, msg) {
        const bar = document.getElementById('status-bar');
        if (bar) {
            bar.className = 'status-bar status-' + type;
            bar.textContent = msg;
        }
    },

    // ===== NAVIGATION =====
    navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        document.getElementById('page-' + page).classList.add('active');
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        const titles = {
            home: 'Dashboard',
            transaksi: 'Transaksi',
            warga: 'Data Warga',
            laporan: 'Laporan',
            pengaturan: 'Pengaturan'
        };
        document.getElementById('header-subtitle').textContent = titles[page];

        // Panggil fungsi render sesuai halaman yang dibuka
        if (page === 'home') {
            this.renderDashboard(); 
            // renderDashboard otomatis akan memanggil renderRekapTahunan()
        } else if (page === 'warga') {
            this.renderListWarga();
        } else if (page === 'transaksi') {
            this.renderListTransaksi();
        }

        document.getElementById('main-content').scrollTop = 0;
    },
    
    // ===== MODAL =====
    openModal(id) {
        document.getElementById(id).classList.add('active');
        if (id === 'modal-input') {
            document.getElementById('tanggal').valueAsDate = new Date();
            const now = new Date();
            document.getElementById('bulan-iuran').value = now.getMonth() + 1;
            this.generateTahunOptions();
        } else if (id === 'modal-pengeluaran') {
            document.getElementById('tgl-pengeluaran').valueAsDate = new Date();
        } else if (id === 'modal-pemasukan-lain') {
            document.getElementById('tgl-pemasukan-lain').valueAsDate = new Date();
        }
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
        if (id === 'modal-input') document.getElementById('form-transaksi').reset();
        
        if (id === 'modal-warga') {
            document.getElementById('form-warga').reset();
            // Sembunyikan tombol hapus setiap kali form warga ditutup
            const btnHapus = document.getElementById('btn-hapus-warga-edit');
            if (btnHapus) btnHapus.style.display = 'none';
        }
        
        if (id === 'modal-pengeluaran') document.getElementById('form-pengeluaran').reset();
        if (id === 'modal-pemasukan-lain') document.getElementById('form-pemasukan-lain').reset();
        
        document.getElementById('edit-id').value = '';
        document.getElementById('edit-warga-id').value = '';
        document.getElementById('edit-pengeluaran-id').value = '';
        document.getElementById('edit-pemasukan-lain-id').value = '';
        
        const now = new Date();
        document.getElementById('bulan-iuran').value = now.getMonth() + 1;
        this.generateTahunOptions();
    },

    // ===== GENERATE TAHUN =====
    generateTahunOptions() {
        const select = document.getElementById('tahun-iuran');
        if (!select) return;
        
        select.innerHTML = '<option value="">Pilih Tahun</option>';
        const tahunSekarang = new Date().getFullYear();
        
        for (let t = tahunSekarang - 1; t <= tahunSekarang + 5; t++) {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            if (t === tahunSekarang) opt.selected = true;
            select.appendChild(opt);
        }
    },

    // ===== WARGA DROPDOWN =====
    updateWargaDropdown() {
        const select = document.getElementById('warga-id');
        if (!select) return;
        
        select.innerHTML = '<option value="">Pilih Warga</option>';
        this.warga.filter(w => w.status === 'aktif')
            .sort((a, b) => a.no_rumah.localeCompare(b.no_rumah, undefined, { numeric: true }))
            .forEach(w => {
                const opt = document.createElement('option');
                opt.value = w.id;
                opt.textContent = `${w.no_rumah} - ${w.nama}`;
                opt.dataset.iuran = w.iuran_bulanan;
                opt.dataset.norumah = w.no_rumah;
                select.appendChild(opt);
            });
    },

    autoFillWarga() {
        const select = document.getElementById('warga-id');
        const opt = select.options[select.selectedIndex];
        if (!opt.value) return;
        document.getElementById('no-rumah').value = opt.dataset.norumah || '';
        document.getElementById('nominal').value = opt.dataset.iuran || '';
    },

    // ===== RENDER DASHBOARD =====
    renderDashboard() {
        let masuk = 0, keluar = 0, tunggakan = 0;
        this.transaksi.forEach(t => {
            if (t.jenis === 'masuk') {
                if (t.status === 'lunas') masuk += t.nominal;
                else if (t.status === 'nunggak') tunggakan += t.nominal;
            } else {
                keluar += t.nominal;
            }
        });

        const wargaAktif = this.warga.filter(w => w.status === 'aktif');
        const target = wargaAktif.reduce((s, w) => s + (w.iuran_bulanan || 0), 0);

        const dashMasuk = document.getElementById('dash-masuk');
        const dashKeluar = document.getElementById('dash-keluar');
        const dashSaldo = document.getElementById('dash-saldo');
        const dashTarget = document.getElementById('dash-target');

        if (dashMasuk) dashMasuk.textContent = this.formatRp(masuk);
        if (dashKeluar) dashKeluar.textContent = this.formatRp(keluar);
        if (dashSaldo) dashSaldo.textContent = this.formatRp(masuk - keluar);
        if (dashTarget) dashTarget.textContent = this.formatRp(target);

        const dashTotal = document.getElementById('dash-warga-total');
        const dashAktif = document.getElementById('dash-warga-aktif');
        const dashTunggak = document.getElementById('dash-warga-tunggak');

        if (dashTotal) dashTotal.textContent = this.warga.length;
        if (dashAktif) dashAktif.textContent = wargaAktif.length;
        if (dashTunggak) dashTunggak.textContent = this.transaksi.filter(t => t.status === 'nunggak').length;

        // --- Panggil Matriks Rekap Iuran di Dashboard ---
        this.prepareRekapTahun();
        this.renderRekapTahunan();
    },

    // ===== RENDER LIST TRANSAKSI =====
    renderListTransaksi() {
        const container = document.getElementById('list-transaksi');
        const filterEl = document.getElementById('filter-transaksi'); 
        if (!container) return;
        
        const filterVal = filterEl ? filterEl.value : 'semua';
        
        let filteredTrx = [...this.transaksi];
        if (filterVal !== 'semua') {
            filteredTrx = filteredTrx.filter(t => t.jenis === filterVal);
        }

        const sorted = filteredTrx.sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>Belum ada transaksi</p>
                </div>`;
            return;
        }

        container.innerHTML = sorted.map(t => `
            <div class="list-item" onclick="app.showDetailTransaksi('${t.id}')"> 
                <div class="list-icon ${t.jenis === 'masuk' ? 'green' : 'red'}">
                    ${t.jenis === 'masuk' ? '💰' : '💸'}
                </div>
                <div class="list-content">
                    <div class="list-title">${t.atas_nama || '-'}</div>
                    <div class="list-subtitle">
                        ${t.no_rumah ? t.no_rumah + ' • ' : ''} 
                        ${t.bulan_iuran ? this.namaBulanSingkat[t.bulan_iuran] + ' ' + (t.tahun_iuran || '') + ' • ' : ''} 
                        ${new Date(t.tanggal).toLocaleDateString('id-ID')}
                    </div>
                </div>
                
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                    <div class="list-amount ${t.jenis === 'masuk' ? 'income' : 'expense'}">
                        ${this.formatRp(t.nominal)}
                    </div>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <span class="badge badge-${t.status === 'lunas' ? 'green' : t.status === 'nunggak' ? 'yellow' : 'red'}">
                            ${t.status}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    // ===== RENDER LIST WARGA =====
    renderListWarga() {
        const container = document.getElementById('list-warga');
        if (!container) return;
        
        const sorted = [...this.warga].sort((a, b) => a.no_rumah.localeCompare(b.no_rumah, undefined, { numeric: true }));

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">👥</div>
                    <p>Belum ada data warga</p>
                </div>`;
            return;
        }

        const TAHUN_MULAI = 2025; // Tahun awal sistem mulai
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        container.innerHTML = sorted.map(w => {
            // Hitung tunggakan dari tahun 2025
            let bulanBelumBayar = 0;
            
            for (let y = TAHUN_MULAI; y <= currentYear; y++) {
                let batasBulan = (y === currentYear) ? currentMonth : 12;
                for (let m = 1; m <= batasBulan; m++) {
                    const sudahBayar = this.transaksi.find(t => 
                        t.warga_id === w.id && 
                        t.tahun_iuran == y && 
                        t.bulan_iuran == m && 
                        t.status === 'lunas' &&
                        t.jenis === 'masuk' &&
                        (!t.kategori || t.kategori === 'iuran-rutin')
                    );
                    if (!sudahBayar) bulanBelumBayar++;
                }
            }
            
            const tunggakan = bulanBelumBayar * (w.iuran_bulanan || 0);

            return `
            <div class="list-item" onclick="app.showDetailWarga('${w.id}')">
                <div class="list-icon ${w.status === 'aktif' ? 'blue' : w.status === 'pindah' ? 'red' : 'yellow'}">
                    🏠
                </div>
                <div class="list-content">
                    <div class="list-title">${w.nama}</div>
                    <div class="list-subtitle">${w.no_rumah} • ${w.hp || 'No HP'}</div>
                </div>
                <div style="text-align: right;">
                    <div class="list-amount" style="color: var(--dark);">${this.formatRp(w.iuran_bulanan)}</div>
                    <span class="badge badge-${w.status === 'aktif' ? 'green' : w.status === 'pindah' ? 'red' : 'yellow'}">
                        ${w.status}
                    </span>
                    ${tunggakan > 0 ? `<div style="font-size: 11px; color: var(--danger); margin-top: 4px;">Tunggak: ${bulanBelumBayar} Bln (${this.formatRp(tunggakan)})</div>` : ''}
                </div>
            </div>
        `}).join('');
    },

    // ===== B. FITUR AKSES ADMIN =====
    mintaAksesAdmin() {
        if (this.isAdmin) {
            if (confirm("Kunci kembali akses admin?")) {
                this.isAdmin = false;
                localStorage.removeItem('kasAdminMode');
                this.applyAdminStatus();
                alert("Akses Admin dikunci.");
            }
            return;
        }

        const pin = prompt("Masukkan PIN Admin:");
        const PIN_BENAR = "12345"; // 🔥 GANTI PIN ANDA DI SINI

        if (pin === PIN_BENAR) {
            alert("Akses Admin Terbuka!");
            this.isAdmin = true;
            localStorage.setItem('kasAdminMode', 'aktif');
            this.applyAdminStatus();
        } else {
            alert("PIN Salah!");
        }
    },

    applyAdminStatus() {
        const elements = {
            'btn-edit-warga-header': this.isAdmin ? 'block' : 'none',
            'btn-lanjut-edit': this.isAdmin ? 'block' : 'none',
            'btn-tambah-warga': this.isAdmin ? 'block' : 'none',
            'btn-group-transaksi': this.isAdmin ? 'flex' : 'none',
            'danger-zone-card': this.isAdmin ? 'block' : 'none' // Tambahkan ini
        };

        for (const [id, displayValue] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.style.display = displayValue;
        }
        
        const lockBtn = document.querySelector('button[onclick="app.mintaAksesAdmin()"]');
        if (lockBtn) lockBtn.style.filter = this.isAdmin ? 'grayscale(0)' : 'grayscale(1)';
    },
    
    // ===== SAVE TRANSAKSI =====
    async saveTransaksi(e) {
        e.preventDefault();
        const btn = document.getElementById('btn-save-trans');
        btn.disabled = true;
        btn.textContent = '⏳...';

        const wargaId = document.getElementById('warga-id').value;
        const w = this.warga.find(x => x.id === wargaId);

        const data = {
            id: document.getElementById('edit-id').value || 'TRX-' + Date.now(),
            tanggal: document.getElementById('tanggal').value,
            jenis: 'masuk',
            kategori: 'iuran-rutin',
            warga_id: wargaId || null,
            no_rumah: document.getElementById('no-rumah').value,
            atas_nama: w ? w.nama : '',
            nominal: parseFloat(document.getElementById('nominal').value) || 0,
            auto_nominal: true,
            status: document.getElementById('status-bayar').value,
            bulan_iuran: document.getElementById('bulan-iuran').value || null,
            tahun_iuran: document.getElementById('tahun-iuran').value || null,
            catatan: document.getElementById('catatan').value
        };

        try {
            if (this.isConnected && this.supabase) {
                const existing = document.getElementById('edit-id').value;
                if (existing) {
                    await this.supabase.from('transaksi').update(data).eq('id', existing);
                    const idx = this.transaksi.findIndex(t => t.id === existing);
                    if (idx >= 0) this.transaksi[idx] = data;
                } else {
                    await this.supabase.from('transaksi').insert([data]);
                    this.transaksi.unshift(data);
                }
            } else {
                const existing = document.getElementById('edit-id').value;
                if (existing) {
                    const idx = this.transaksi.findIndex(t => t.id === existing);
                    if (idx >= 0) this.transaksi[idx] = data;
                } else {
                    this.transaksi.unshift(data);
                }
                this.saveLocal();
            }

            this.closeModal('modal-input');
            this.renderDashboard();
            this.renderListTransaksi();
            this.updateStatus('online', '✓ Tersimpan');
        } catch(err) {
            alert('Gagal: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 Simpan ke Cloud';
        }
    },

    // ===== SAVE PENGELUARAN =====
    async savePengeluaran(e) {
        e.preventDefault();
        const btn = document.getElementById('btn-save-pengeluaran');
        btn.disabled = true;
        btn.textContent = '⏳...';

        const keterangan = document.getElementById('keterangan-pengeluaran').value;

        const data = {
            id: document.getElementById('edit-pengeluaran-id').value || 'TRX-OUT-' + Date.now(),
            tanggal: document.getElementById('tgl-pengeluaran').value,
            jenis: 'keluar',
            kategori: 'pengeluaran-umum',
            warga_id: null,
            no_rumah: '',
            atas_nama: keterangan, 
            nominal: parseFloat(document.getElementById('nominal-pengeluaran').value) || 0,
            auto_nominal: false,
            status: 'lunas',
            bulan_iuran: null,
            tahun_iuran: null,
            catatan: keterangan
        };

        try {
            if (this.isConnected && this.supabase) {
                const existing = document.getElementById('edit-pengeluaran-id').value;
                if (existing) {
                    await this.supabase.from('transaksi').update(data).eq('id', existing);
                    const idx = this.transaksi.findIndex(t => t.id === existing);
                    if (idx >= 0) this.transaksi[idx] = data;
                } else {
                    await this.supabase.from('transaksi').insert([data]);
                    this.transaksi.unshift(data);
                }
            } else {
                const existing = document.getElementById('edit-pengeluaran-id').value;
                if (existing) {
                    const idx = this.transaksi.findIndex(t => t.id === existing);
                    if (idx >= 0) this.transaksi[idx] = data;
                } else {
                    this.transaksi.unshift(data);
                }
                this.saveLocal();
            }

            this.closeModal('modal-pengeluaran');
            this.renderDashboard();
            this.renderListTransaksi();
            this.updateStatus('online', '✓ Pengeluaran Tersimpan');
        } catch(err) {
            alert('Gagal: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 Simpan ke Cloud';
        }
    },

    // ===== SAVE PEMASUKAN LAIN =====
    async savePemasukanLain(e) {
        e.preventDefault();
        const btn = document.getElementById('btn-save-pemasukan-lain');
        btn.disabled = true;
        btn.textContent = '⏳...';

        const keterangan = document.getElementById('keterangan-pemasukan-lain').value;

        const data = {
            id: document.getElementById('edit-pemasukan-lain-id').value || 'TRX-IN-' + Date.now(),
            tanggal: document.getElementById('tgl-pemasukan-lain').value,
            jenis: 'masuk',
            kategori: 'pemasukan-lain',
            warga_id: null,
            no_rumah: '',
            atas_nama: keterangan,
            nominal: parseFloat(document.getElementById('nominal-pemasukan-lain').value) || 0,
            auto_nominal: false,
            status: 'lunas',
            bulan_iuran: null,
            tahun_iuran: null,
            catatan: keterangan
        };

        try {
            if (this.isConnected && this.supabase) {
                const existing = document.getElementById('edit-pemasukan-lain-id').value;
                if (existing) {
                    await this.supabase.from('transaksi').update(data).eq('id', existing);
                    const idx = this.transaksi.findIndex(t => t.id === existing);
                    if (idx >= 0) this.transaksi[idx] = data;
                } else {
                    await this.supabase.from('transaksi').insert([data]);
                    this.transaksi.unshift(data);
                }
            } else {
                const existing = document.getElementById('edit-pemasukan-lain-id').value;
                if (existing) {
                    const idx = this.transaksi.findIndex(t => t.id === existing);
                    if (idx >= 0) this.transaksi[idx] = data;
                } else {
                    this.transaksi.unshift(data);
                }
                this.saveLocal();
            }

            this.closeModal('modal-pemasukan-lain');
            this.renderDashboard();
            this.renderListTransaksi();
            this.updateStatus('online', '✓ Pemasukan Lain Tersimpan');
        } catch(err) {
            alert('Gagal: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 Simpan ke Cloud';
        }
    },

    // ===== SAVE WARGA =====
    async saveWarga(e) {
        e.preventDefault();
        const data = {
            id: document.getElementById('edit-warga-id').value || 'W-' + Date.now(),
            nama: document.getElementById('warga-nama').value,
            no_rumah: document.getElementById('warga-no-rumah').value,
            hp: document.getElementById('warga-hp').value,
            iuran_bulanan: parseFloat(document.getElementById('warga-iuran').value) || 0,
            status: document.getElementById('warga-status').value,
            tanggal_masuk: null,
            alamat: ''
        };

        try {
            if (this.isConnected && this.supabase) {
                const existing = document.getElementById('edit-warga-id').value;
                if (existing) {
                    await this.supabase.from('warga').update(data).eq('id', existing);
                    const idx = this.warga.findIndex(w => w.id === existing);
                    if (idx >= 0) this.warga[idx] = data;
                } else {
                    await this.supabase.from('warga').insert([data]);
                    this.warga.push(data);
                }
            } else {
                const existing = document.getElementById('edit-warga-id').value;
                if (existing) {
                    const idx = this.warga.findIndex(w => w.id === existing);
                    if (idx >= 0) this.warga[idx] = data;
                } else {
                    this.warga.push(data);
                }
                this.saveLocal();
            }

            this.closeModal('modal-warga');
            this.updateWargaDropdown();
            this.renderDashboard();
            this.renderListWarga();
        } catch(err) {
            alert('Gagal: ' + err.message);
        }
    },

    // ===== EDIT & DETAIL TRANSAKSI =====
    editTransaksi(id) {
        const t = this.transaksi.find(x => x.id === id);
        if (!t) return;
        
        if (t.jenis === 'keluar') {
            document.getElementById('edit-pengeluaran-id').value = t.id;
            document.getElementById('tgl-pengeluaran').value = t.tanggal;
            document.getElementById('nominal-pengeluaran').value = t.nominal;
            document.getElementById('keterangan-pengeluaran').value = t.catatan || t.atas_nama || '';
            this.openModal('modal-pengeluaran');
        } else if (t.jenis === 'masuk' && t.kategori === 'pemasukan-lain') {
            document.getElementById('edit-pemasukan-lain-id').value = t.id;
            document.getElementById('tgl-pemasukan-lain').value = t.tanggal;
            document.getElementById('nominal-pemasukan-lain').value = t.nominal;
            document.getElementById('keterangan-pemasukan-lain').value = t.catatan || t.atas_nama || '';
            this.openModal('modal-pemasukan-lain');
        } else {
            // Ini untuk transaksi Iuran standar
            document.getElementById('edit-id').value = t.id;
            document.getElementById('warga-id').value = t.warga_id || '';
            document.getElementById('no-rumah').value = t.no_rumah || '';
            document.getElementById('nominal').value = t.nominal;
            document.getElementById('tanggal').value = t.tanggal;
            document.getElementById('status-bayar').value = t.status;
            document.getElementById('catatan').value = t.catatan || '';
            
            document.getElementById('bulan-iuran').value = t.bulan_iuran || '';
            
            this.generateTahunOptions();
            if (t.tahun_iuran) {
                const tahunSelect = document.getElementById('tahun-iuran');
                if ([...tahunSelect.options].some(o => o.value == t.tahun_iuran)) {
                    tahunSelect.value = t.tahun_iuran;
                }
            }
            this.openModal('modal-input');
        }
    },

    showDetailTransaksi(id) {
        const t = this.transaksi.find(x => x.id === id);
        if (!t) return;

        const container = document.getElementById('content-detail-transaksi');
        const isMasuk = t.jenis === 'masuk';
        
        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 40px;">${isMasuk ? '💰' : '💸'}</div>
                <div style="font-size: 24px; font-weight: 800; color: ${isMasuk ? '#11998e' : '#eb3349'};">
                    ${isMasuk ? '+' : '-'}${this.formatRp(t.nominal)}
                </div>
                <div class="badge badge-${t.status === 'lunas' ? 'green' : t.status === 'nunggak' ? 'yellow' : 'red'}" style="margin-top: 8px;">
                    ${t.status.toUpperCase()}
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 100px 1fr; gap: 12px; color: var(--dark); background: var(--light); padding: 16px; border-radius: 12px;">
                <div style="color: var(--gray); font-weight: 600;">Kategori</div><div>: ${t.kategori === 'pemasukan-lain' ? 'Pemasukan Lain' : t.kategori === 'pengeluaran-umum' ? 'Pengeluaran' : 'Iuran Rutin'}</div>
                <div style="color: var(--gray); font-weight: 600;">Nama/Ket.</div><div style="font-weight: 700;">: ${t.atas_nama || '-'}</div>
                <div style="color: var(--gray); font-weight: 600;">No. Rumah</div><div>: ${t.no_rumah || '-'}</div>
                <div style="color: var(--gray); font-weight: 600;">Tanggal</div><div>: ${new Date(t.tanggal).toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
                <div style="color: var(--gray); font-weight: 600;">Periode</div><div>: ${t.bulan_iuran ? this.namaBulan[t.bulan_iuran] : '-'} ${t.tahun_iuran || ''}</div>
                <div style="color: var(--gray); font-weight: 600;">Catatan</div><div>: ${t.catatan || '-'}</div>
            </div>
        `;

        const btnEdit = document.getElementById('btn-lanjut-edit');
        if (btnEdit) {
            btnEdit.onclick = () => {
                this.closeModal('modal-detail-transaksi');
                this.editTransaksi(id);
            };
        }
        this.applyAdminStatus();
        this.openModal('modal-detail-transaksi');
    },

    // ===== EDIT & DETAIL WARGA =====
    editWarga(id) {
        const w = this.warga.find(x => x.id === id);
        if (!w) return;
        document.getElementById('edit-warga-id').value = w.id;
        document.getElementById('warga-nama').value = w.nama;
        document.getElementById('warga-no-rumah').value = w.no_rumah;
        document.getElementById('warga-hp').value = w.hp || '';
        document.getElementById('warga-iuran').value = w.iuran_bulanan || 0;
        document.getElementById('warga-status').value = w.status;
        
        // Tampilkan tombol hapus saat masuk mode edit
        const btnHapus = document.getElementById('btn-hapus-warga-edit');
        if (btnHapus) {
            btnHapus.style.display = 'block';
            btnHapus.onclick = () => this.deleteWarga(w.id);
        }
        
        this.openModal('modal-warga');
    },

    // ===== DETAIL WARGA =====
    showDetailWarga(id) {
        const w = this.warga.find(x => x.id === id);
        if (!w) return;

        const container = document.getElementById('content-detail-warga');
        const TAHUN_MULAI = 2025;
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; 
        
        let bulanBelumBayar = 0;
        let detailBulanTunggak = [];

        for (let y = TAHUN_MULAI; y <= currentYear; y++) {
            let batasBulan = (y === currentYear) ? currentMonth : 12;
            for (let m = 1; m <= batasBulan; m++) {
                const sudahBayar = this.transaksi.find(t => 
                    t.warga_id === w.id && t.tahun_iuran == y && t.bulan_iuran == m && 
                    t.status === 'lunas' && t.jenis === 'masuk' && (!t.kategori || t.kategori === 'iuran-rutin')
                );
                if (!sudahBayar) {
                    bulanBelumBayar++;
                    detailBulanTunggak.push(`${this.namaBulanSingkat[m]} ${y.toString().slice(-2)}`);
                }
            }
        }

        const totalTunggakan = bulanBelumBayar * (w.iuran_bulanan || 0);
        
        let teksTunggakan = `<span style="color: var(--success);">Tidak ada (Lunas)</span>`;
        if (bulanBelumBayar > 0) {
            teksTunggakan = `${this.formatRp(totalTunggakan)} <br><span style="font-size: 11px; font-weight: normal; color: var(--gray);">(${detailBulanTunggak.join(', ')})</span>`;
        }

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 110px 1fr; gap: 8px;">
                <div style="color: var(--gray);">Nama Lengkap</div><div style="font-weight: 700;">: ${w.nama}</div>
                <div style="color: var(--gray);">No. Rumah</div><div>: ${w.no_rumah}</div>
                <div style="color: var(--gray);">Iuran Bulanan</div><div>: ${this.formatRp(w.iuran_bulanan)}</div>
                <div style="color: var(--gray);">No. HP</div><div>: ${w.hp || '-'}</div>
                <div style="color: var(--gray);">Status</div><div>: ${w.status.toUpperCase()}</div>
                <div style="color: var(--gray);">Tunggakan</div><div style="color: var(--danger); font-weight: bold; line-height: 1.4;">: ${teksTunggakan}</div>
            </div>
        `;

        document.getElementById('edit-warga-id').value = w.id; 
        
        const btnEditHeader = document.getElementById('btn-edit-warga-header');
        if (btnEditHeader) btnEditHeader.onclick = () => {
            this.closeModal('modal-detail-warga');
            this.editWarga(w.id);
        };
        this.applyAdminStatus();
        this.openModal('modal-detail-warga');
    },

    async deleteWarga(id) {
        if (!confirm('Hapus warga ini? Seluruh riwayat transaksi terkait juga akan dihapus.')) return;
        
        try {
            if (this.isConnected && this.supabase) {
                await this.supabase.from('warga').delete().eq('id', id);
                await this.supabase.from('transaksi').delete().eq('warga_id', id);
            }
            
            this.warga = this.warga.filter(w => w.id !== id);
            this.transaksi = this.transaksi.filter(t => t.warga_id !== id);
            this.saveLocal();
            
            this.closeModal('modal-warga'); // <-- Menutup form edit
            this.renderDashboard();
            this.renderListWarga();
            this.updateWargaDropdown();
            alert('Data warga berhasil dihapus.');
        } catch(err) {
            alert('Gagal menghapus: ' + err.message);
        }
    },

    // ===== LAPORAN =====
    generateLaporan() {
        const periode = document.getElementById('laporan-bulan').value;
        if (!periode) return;

        const [tahun, bulan] = periode.split('-');
        const filtered = this.transaksi.filter(t => t.tahun_iuran == tahun && t.bulan_iuran == bulan);
        const wargaAktif = this.warga.filter(w => w.status === 'aktif').sort((a,b) => a.no_rumah.localeCompare(b.no_rumah));

        let diterima = 0, target = 0;
        let rows = '';

        wargaAktif.forEach((w, idx) => {
            const t = filtered.find(x => x.warga_id === w.id && x.jenis === 'masuk');
            const status = t ? t.status : 'belum';
            const badge = status === 'lunas' ? 'green' : status === 'nunggak' ? 'yellow' : 'red';
            const nominal = t ? t.nominal : w.iuran_bulanan;

            if (status === 'lunas') diterima += nominal;
            target += w.iuran_bulanan;

            rows += `
                <div class="list-item">
                    <div class="list-icon blue">${idx + 1}</div>
                    <div class="list-content">
                        <div class="list-title">${w.nama}</div>
                        <div class="list-subtitle">${w.no_rumah}</div>
                    </div>
                    <div style="text-align: right;">
                        <div class="list-amount" style="color: var(--dark);">${this.formatRp(nominal)}</div>
                        <span class="badge badge-${badge}">${status}</span>
                    </div>
                </div>
            `;
        });

        document.getElementById('laporan-hasil').innerHTML = `
            <div class="card">
                <div class="card-title">📊 Ringkasan ${this.namaBulan[parseInt(bulan)]} ${tahun}</div>
                <div class="info-grid" style="margin-bottom: 0;">
                    <div class="info-item target">
                        <div class="label">Target</div>
                        <div class="value">${this.formatRp(target)}</div>
                    </div>
                    <div class="info-item income">
                        <div class="label">Diterima</div>
                        <div class="value">${this.formatRp(diterima)}</div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-title">📋 Detail Per Warga</div>
                ${rows || '<div class="empty"><p>Belum ada data</p></div>'}
            </div>
        `;
    },

    // ===== CHECKLIST KARTU IURAN =====
    bukaKartuIuran() {
        const wId = document.getElementById('edit-warga-id').value;
        if (!wId) {
            alert('Warga tidak ditemukan!');
            return;
        }
        
        // Tutup modal detail warga, buka modal kartu
        this.closeModal('modal-detail-warga');
        document.getElementById('kartu-warga-id').value = wId;

        // Isi dropdown tahun (2 tahun ke belakang, 2 ke depan)
        const sel = document.getElementById('kartu-tahun');
        sel.innerHTML = '';
        const yr = new Date().getFullYear();
    const TAHUN_MULAI = 2025; // Tambahkan ini
    sel.innerHTML = '';
    for(let i = TAHUN_MULAI; i <= yr + 1; i++) { // Ubah loop-nya
        sel.innerHTML += `<option value="${i}" ${i === yr ? 'selected' : ''}>Tahun ${i}</option>`;
    }

        this.renderKartuIuran();
        this.openModal('modal-kartu-iuran');
    },

    renderKartuIuran() {
        const wId = document.getElementById('kartu-warga-id').value;
        const tahun = document.getElementById('kartu-tahun').value;
        const grid = document.getElementById('grid-kartu-iuran');
        const instruksi = document.querySelector('#modal-kartu-iuran p');
        if (instruksi) {
            instruksi.style.display = this.isAdmin ? 'block' : 'none';
        }
        grid.innerHTML = '';

        const trx = this.transaksi.filter(t => t.warga_id === wId && t.tahun_iuran == tahun && t.status === 'lunas' && t.jenis === 'masuk' && (!t.kategori || t.kategori === 'iuran-rutin'));

        for(let i = 1; i <= 12; i++) {
            const sudahBayar = trx.find(t => t.bulan_iuran == i);
            const bg = sudahBayar ? '#c6f6d5' : '#fff5f5'; 
            const border = sudahBayar ? '#38a169' : '#fc8181';
            const icon = sudahBayar ? '✅' : '❌';

            grid.innerHTML += `
                <div style="background: ${bg}; border: 1px solid ${border}; padding: 12px 4px; border-radius: 12px; text-align: center; cursor: pointer; transition: 0.2s;"
                     onclick="app.toggleIuran('${wId}', ${tahun}, ${i})">
                    <div style="font-size: 11px; font-weight: 700; color: var(--dark);">${this.namaBulanSingkat[i]}</div>
                    <div style="font-size: 18px; margin-top: 6px;">${icon}</div>
                </div>
            `;
        }
    },

    async toggleIuran(wId, tahun, bulan) {
        // --- TAMBAHKAN PENGECEKAN INI ---
        if (!this.isAdmin) {
            alert('Akses Ditolak: Hanya Admin yang dapat mengubah status pembayaran.');
            return;
        }
        const warga = this.warga.find(w => w.id === wId);
        const trxIndex = this.transaksi.findIndex(t => t.warga_id === wId && t.tahun_iuran == tahun && t.bulan_iuran == bulan && t.jenis === 'masuk' && (!t.kategori || t.kategori === 'iuran-rutin'));

        if (trxIndex >= 0) {
            if(confirm(`Batalkan pembayaran ${this.namaBulan[bulan]} ${tahun}?`)) {
                const tId = this.transaksi[trxIndex].id;
                this.transaksi.splice(trxIndex, 1);
                
                if (this.isConnected && this.supabase) {
                    await this.supabase.from('transaksi').delete().eq('id', tId);
                } else {
                    this.saveLocal();
                }
            }
        } else {
            if(confirm(`Tandai LUNAS iuran ${this.namaBulan[bulan]} ${tahun}?`)) {
                const data = {
                    id: 'TRX-CHK-' + Date.now(),
                    tanggal: new Date().toISOString().split('T')[0], 
                    jenis: 'masuk',
                    kategori: 'iuran-rutin',
                    warga_id: wId,
                    no_rumah: warga.no_rumah,
                    atas_nama: warga.nama,
                    nominal: warga.iuran_bulanan || 0,
                    auto_nominal: true,
                    status: 'lunas',
                    bulan_iuran: bulan.toString(),
                    tahun_iuran: tahun.toString(),
                    catatan: 'Dari sistem checklist'
                };
                this.transaksi.unshift(data);
                
                if (this.isConnected && this.supabase) {
                    await this.supabase.from('transaksi').insert([data]);
                } else {
                    this.saveLocal();
                }
            }
        }
        
        this.renderKartuIuran();
        this.renderDashboard();
        this.renderListTransaksi();
    },

    // ===== FITUR REKAP TAHUNAN =====
    prepareRekapTahun() {
        const select = document.getElementById('rekap-tahun-select');
        if (select) {
            const TAHUN_MULAI = 2025; // Tetapkan tahun awal sistem
            const yr = new Date().getFullYear();
            const TAHUN_AKHIR = yr + 1; // Selalu tampilkan sampai 1 tahun ke depan
            
            let html = '';
            for (let i = TAHUN_MULAI; i <= TAHUN_AKHIR; i++) {
                html += `<option value="${i}" ${i === yr ? 'selected' : ''}>${i}</option>`;
            }
            select.innerHTML = html;
        }
    },

    renderRekapTahunan() {
        const tahun = document.getElementById('rekap-tahun-select').value;
        const thead = document.getElementById('thead-rekap');
        const tbody = document.getElementById('tbody-rekap');
        if (!thead || !tbody) return;

        let headerHtml = `<tr><th>Warga</th>`;
        for (let i = 1; i <= 12; i++) {
            headerHtml += `<th>${this.namaBulanSingkat[i]}</th>`;
        }
        headerHtml += `</tr>`;
        thead.innerHTML = headerHtml;

        const wargaAktif = this.warga.filter(w => w.status === 'aktif').sort((a, b) => 
            a.no_rumah.localeCompare(b.no_rumah, undefined, { numeric: true, sensitivity: 'base' })
        );
        
        tbody.innerHTML = wargaAktif.map(w => {
            let row = `<tr><td>${w.no_rumah}<br><small>${w.nama}</small></td>`;
            for (let bulan = 1; bulan <= 12; bulan++) {
                const lunas = this.transaksi.find(t => 
                    t.warga_id === w.id && 
                    t.tahun_iuran == tahun && 
                    t.bulan_iuran == bulan && 
                    t.status === 'lunas'
                );
                row += `<td style="background: ${lunas ? '#c6f6d5' : '#fff5f5'}">${lunas ? '✅' : '❌'}</td>`;
            }
            row += `</tr>`;
            return row;
        }).join('');
    },

    // ===== EXPORT/IMPORT =====
    exportAllCSV() {
        let csv = 'Data Warga\nID,Nama,No Rumah,HP,Status,Iuran\n';
        this.warga.forEach(w => {
            csv += `${w.id},${w.nama},${w.no_rumah},${w.hp || ''},${w.status},${w.iuran_bulanan}\n`;
        });
        csv += '\nTransaksi\nID,Tanggal,No Rumah,Atas Nama,Jenis,Nominal,Status,Bulan,Tahun\n';
        this.transaksi.forEach(t => {
            csv += `${t.id},${t.tanggal},${t.no_rumah || ''},${t.atas_nama},${t.jenis},${t.nominal},${t.status},${t.bulan_iuran || ''},${t.tahun_iuran || ''}\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Backup_Kas_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
    },

    // ===== EXPORT REKAP TAHUNAN (MATRIKS) =====
    exportRekapTahunanCSV() {
        const tahun = document.getElementById('rekap-tahun-select').value;
        let csv = `REKAP IURAN WARGA TAHUN ${tahun}\n\n`;
        
        const headers = ['No. Rumah', 'Nama'];
        for (let i = 1; i <= 12; i++) {
            headers.push(this.namaBulan[i]);
        }
        csv += headers.join(';') + '\n'; 
        
        const wargaAktif = this.warga.filter(w => w.status === 'aktif')
                                     .sort((a,b) => a.no_rumah.localeCompare(b.no_rumah, undefined, {numeric: true}));
        
        wargaAktif.forEach(w => {
            let row = [w.no_rumah, w.nama];
            
            for (let bulan = 1; bulan <= 12; bulan++) {
                const lunas = this.transaksi.find(t => 
                    t.warga_id === w.id && 
                    t.tahun_iuran == tahun && 
                    t.bulan_iuran == bulan && 
                    t.status === 'lunas'
                );
                
                row.push(lunas ? 'LUNAS' : '-');
            } 
            
            csv += row.join(';') + '\n';
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `Rekap_Iuran_${tahun}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    
    // ===== EXPORT PENGELUARAN =====
    exportPengeluaranCSV() {
        let csv = 'LAPORAN DATA PENGELUARAN\n\n';
        
        csv += 'Tanggal;Keterangan / Keperluan;Nominal (Rp)\n';
        
        const pengeluaran = this.transaksi
            .filter(t => t.jenis === 'keluar')
            .sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));
            
        if (pengeluaran.length === 0) {
            alert('Belum ada data pengeluaran yang bisa diexport.');
            return;
        }

        let totalPengeluaran = 0;

        pengeluaran.forEach(t => {
            const tgl = new Date(t.tanggal).toLocaleDateString('id-ID'); 
            const keterangan = t.atas_nama || t.catatan || '-';
            const nominal = t.nominal;
            
            csv += `${tgl};${keterangan};${nominal}\n`;
            totalPengeluaran += nominal;
        });

        csv += `\n;TOTAL PENGELUARAN;${totalPengeluaran}\n`;

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `Laporan_Pengeluaran_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    importCSV(input) {
        const file = input.files[0];
        if (!file) return;
        alert('✅ File diterima. Untuk restore lengkap, gunakan koneksi Supabase.');
    },

    // ===== RESET =====
    async resetAllData() {
        if (!confirm('⚠️ Hapus SEMUA data?')) return;
        if (!confirm('Yakin? Data tidak bisa dikembalikan!')) return;

        this.transaksi = []; this.warga = []; this.nextId = 1;
        localStorage.clear();

        if (this.isConnected && this.supabase) {
            await this.supabase.from('transaksi').delete().neq('id', 'x');
            await this.supabase.from('warga').delete().neq('id', 'x');
        }

        this.renderDashboard();
        this.renderListTransaksi();
        this.renderListWarga();
        this.updateWargaDropdown();
        alert('✅ Semua data dihapus');
    }
};

// ===== START APP =====
document.addEventListener('DOMContentLoaded', () => app.init());
