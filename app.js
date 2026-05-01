// ===== KAS PERUMAHAN - APP LOGIC =====

const app = {
    // Supabase
    supabase: null,
    isConnected: false,
    SB_URL: localStorage.getItem('sb_url') || '',
    SB_KEY: localStorage.getItem('sb_key') || '',

    // Data
    warga: [],
    transaksi: [],
    nextId: parseInt(localStorage.getItem('kasNextId')) || 1,

    // Constants
    namaBulan: ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],

    // ===== INIT =====
    init() {
        // Pre-fill settings
        document.getElementById('sb-url').value = this.SB_URL;
        document.getElementById('sb-key').value = this.SB_KEY;

        // Set default date
        document.getElementById('tanggal').valueAsDate = new Date();
        const now = new Date();
        document.getElementById('bulan-iuran').value = now.getMonth() + 1;
        document.getElementById('tahun-iuran').value = now.getFullYear();

        // Connect or load local
        if (this.SB_URL && this.SB_KEY) {
            this.initSupabase();
            this.testConnection();
        } else {
            this.loadLocal();
            this.updateStatus('offline', '⚠️ Offline - Setup Supabase di Pengaturan');
        }

        // Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(console.error);
        }
    },

    // ===== SUPABASE =====
    initSupabase() {
        if (!this.SB_URL || !this.SB_KEY) return false;
        try {
            this.supabase = window.supabase.createClient(this.SB_URL, this.SB_KEY);
            return true;
        } catch(e) { return false; }
    },

    async testConnection() {
        if (!this.initSupabase()) {
            this.updateStatus('offline', '❌ URL/Key belum diisi');
            return;
        }
        this.updateStatus('syncing', '⏳ Menghubungkan...');

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
            const { data: w } = await this.supabase.from('warga').select('*').order('no_rumah');
            const { data: t } = await this.supabase.from('transaksi').select('*').order('tanggal', { ascending: false });

            this.warga = w || [];
            this.transaksi = t || [];

            this.updateWargaDropdown();
            this.renderDashboard();
            this.renderListTransaksi();
            this.renderListWarga();
        } catch(err) {
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

    // ===== UI HELPERS =====
    formatRp(n) {
        if (!n && n !== 0) return 'Rp0';
        return 'Rp' + n.toLocaleString('id-ID');
    },

    updateStatus(type, msg) {
        const bar = document.getElementById('status-bar');
        bar.className = 'status-bar status-' + type;
        bar.textContent = msg;
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

        if (page === 'transaksi') this.renderListTransaksi();
        if (page === 'warga') this.renderListWarga();
        if (page === 'home') this.renderDashboard();

        document.getElementById('main-content').scrollTop = 0;
    },

    // ===== MODAL =====
    openModal(id) {
        document.getElementById(id).classList.add('active');
        if (id === 'modal-input') {
            document.getElementById('tanggal').valueAsDate = new Date();
        }
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
        document.getElementById('form-transaksi').reset();
        document.getElementById('form-warga').reset();
        document.getElementById('edit-id').value = '';
        document.getElementById('edit-warga-id').value = '';
    },

    // ===== WARGA DROPDOWN =====
    updateWargaDropdown() {
        const select = document.getElementById('warga-id');
        select.innerHTML = '<option value="">Pilih Warga</option>';
        this.warga.filter(w => w.status === 'aktif')
            .sort((a,b) => a.no_rumah.localeCompare(b.no_rumah))
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

        document.getElementById('dash-masuk').textContent = this.formatRp(masuk);
        document.getElementById('dash-keluar').textContent = this.formatRp(keluar);
        document.getElementById('dash-saldo').textContent = this.formatRp(masuk - keluar);
        document.getElementById('dash-target').textContent = this.formatRp(target);

        document.getElementById('dash-warga-total').textContent = this.warga.length;
        document.getElementById('dash-warga-aktif').textContent = wargaAktif.length;
        document.getElementById('dash-warga-tunggak').textContent = this.transaksi.filter(t => t.status === 'nunggak').length;

        // Recent transactions
        const recent = [...this.transaksi].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 5);
        const container = document.getElementById('dash-transaksi');

        if (recent.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>Belum ada transaksi</p>
                </div>`;
            return;
        }

        container.innerHTML = recent.map(t => `
            <div class="list-item" onclick="app.editTransaksi('${t.id}')">
                <div class="list-icon ${t.jenis === 'masuk' ? 'green' : 'red'}">
                    ${t.jenis === 'masuk' ? '💰' : '💸'}
                </div>
                <div class="list-content">
                    <div class="list-title">${t.atas_nama || t.no_rumah || '-'}</div>
                    <div class="list-subtitle">${new Date(t.tanggal).toLocaleDateString('id-ID')} • ${t.status}</div>
                </div>
                <div class="list-amount ${t.jenis === 'masuk' ? 'income' : 'expense'}">
                    ${t.jenis === 'masuk' ? '+' : '-'}${this.formatRp(t.nominal)}
                </div>
            </div>
        `).join('');
    },

    // ===== RENDER LIST TRANSAKSI =====
    renderListTransaksi() {
        const container = document.getElementById('list-transaksi');
        const sorted = [...this.transaksi].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>Belum ada transaksi</p>
                </div>`;
            return;
        }

        container.innerHTML = sorted.map(t => `
            <div class="list-item" onclick="app.editTransaksi('${t.id}')">
                <div class="list-icon ${t.jenis === 'masuk' ? 'green' : 'red'}">
                    ${t.jenis === 'masuk' ? '💰' : '💸'}
                </div>
                <div class="list-content">
                    <div class="list-title">${t.atas_nama || '-'}</div>
                    <div class="list-subtitle">
                        ${t.no_rumah || '-'} • ${new Date(t.tanggal).toLocaleDateString('id-ID')}
                        ${t.bulan_iuran ? `• ${this.namaBulan[t.bulan_iuran]} ${t.tahun_iuran}` : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="list-amount ${t.jenis === 'masuk' ? 'income' : 'expense'}">
                        ${this.formatRp(t.nominal)}
                    </div>
                    <span class="badge badge-${t.status === 'lunas' ? 'green' : t.status === 'nunggak' ? 'yellow' : 'red'}">
                        ${t.status}
                    </span>
                </div>
            </div>
        `).join('');
    },

    // ===== RENDER LIST WARGA =====
    renderListWarga() {
        const container = document.getElementById('list-warga');
        const sorted = [...this.warga].sort((a,b) => a.no_rumah.localeCompare(b.no_rumah));

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">👥</div>
                    <p>Belum ada data warga</p>
                </div>`;
            return;
        }

        container.innerHTML = sorted.map(w => {
            const tunggakan = this.transaksi.filter(t => t.warga_id === w.id && t.status === 'nunggak')
                                           .reduce((s,t) => s + t.nominal, 0);
            return `
            <div class="list-item" onclick="app.editWarga('${w.id}')">
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
                    ${tunggakan > 0 ? `<div style="font-size: 11px; color: var(--danger); margin-top: 4px;">Tunggak: ${this.formatRp(tunggakan)}</div>` : ''}
                </div>
            </div>
        `}).join('');
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

    // ===== SAVE WARGA =====
    async saveWarga(e) {
        e.preventDefault();
        const data = {
            id: document.getElementById('edit-warga-id').value || 'W-' + (this.nextId++),
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

    // ===== EDIT =====
    editTransaksi(id) {
        const t = this.transaksi.find(x => x.id === id);
        if (!t) return;
        document.getElementById('edit-id').value = t.id;
        document.getElementById('warga-id').value = t.warga_id || '';
        document.getElementById('no-rumah').value = t.no_rumah || '';
        document.getElementById('nominal').value = t.nominal;
        document.getElementById('tanggal').value = t.tanggal;
        document.getElementById('bulan-iuran').value = t.bulan_iuran || '';
        document.getElementById('tahun-iuran').value = t.tahun_iuran || '';
        document.getElementById('status-bayar').value = t.status;
        document.getElementById('catatan').value = t.catatan || '';
        this.openModal('modal-input');
    },

    editWarga(id) {
        const w = this.warga.find(x => x.id === id);
        if (!w) return;
        document.getElementById('edit-warga-id').value = w.id;
        document.getElementById('warga-nama').value = w.nama;
        document.getElementById('warga-no-rumah').value = w.no_rumah;
        document.getElementById('warga-hp').value = w.hp || '';
        document.getElementById('warga-iuran').value = w.iuran_bulanan || 0;
        document.getElementById('warga-status').value = w.status;
        this.openModal('modal-warga');
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

    // ===== PENGATURAN =====
    saveConfig() {
        this.SB_URL = document.getElementById('sb-url').value.trim();
        this.SB_KEY = document.getElementById('sb-key').value.trim();
        localStorage.setItem('sb_url', this.SB_URL);
        localStorage.setItem('sb_key', this.SB_KEY);
        this.testConnection();
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
