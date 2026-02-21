// Settings Panel - Tabbed layout with skin selector
class SettingsPanel {
    constructor(giftConfig) {
        this.giftConfig = giftConfig;
        this.isOpen = false;
        this.guideOpen = false;
        this.activeTab = 'connection';
        this.activeGuideTab = 'overview';
        this.giftCatalog = this._buildGiftCatalog();
        this._giftPickerTargetRow = null;
        this._createPanel();
        this._bindEvents();
        this._bindSocketGiftCatalogEvents();
        this._applyProfileBlurToDom();
    }

    _createPanel() {
        // Settings button
        this.settingsBtn = document.createElement('button');
        this.settingsBtn.id = 'settingsBtn';
        this.settingsBtn.className = 'btn-settings';
        this.settingsBtn.innerHTML = '⚙️';
        this.settingsBtn.title = 'Ayarlar';
        this.settingsBtn.style.display = 'none';
        document.body.appendChild(this.settingsBtn);

        // Guide button
        this.guideBtn = document.createElement('button');
        this.guideBtn.id = 'guideBtn';
        this.guideBtn.className = 'btn-guide';
        this.guideBtn.innerHTML = '📘';
        this.guideBtn.title = 'Rehber';
        this.guideBtn.style.display = 'none';
        document.body.appendChild(this.guideBtn);

        // Settings overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'settings-overlay';
        this.overlay.style.display = 'none';
        this.overlay.innerHTML = `
            <div class="settings-panel">
                <div class="settings-header">
                    <h2>⚙️ Oyun Ayarları</h2>
                    <button class="settings-close">✕</button>
                </div>
                <div class="settings-tabs">
                    <button class="tab-btn active" data-tab="connection">📡 Baglanti</button>
                    <button class="tab-btn" data-tab="battle">⚔️ Oyun</button>
                    <button class="tab-btn" data-tab="interaction">💜 Etkilesim</button>
                    <button class="tab-btn" data-tab="audio">🔊 Ses</button>
                    <button class="tab-btn" data-tab="skins">🎨 Görünüm</button>
                    <button class="tab-btn" data-tab="gifts">🎁 Hediyeler</button>
                    <button class="tab-btn" data-tab="windows">🪟 Pencereler</button>
                    <button class="tab-btn" data-tab="compliance">⚖️ Ihlal Koruma</button>
                </div>
                <div class="settings-body">
                    <!-- TAB: CONNECTION -->
                    <div class="tab-content active" data-tab="connection">
                        <div class="settings-section">
                            <h3>📡 Yayinci Baglanti</h3>
                            <div class="connection-settings-card">
                                <div class="input-group settings-input-group">
                                    <label for="settingsUsernameInput">TikTok Yayinci Adlari</label>
                                    <div class="input-wrapper">
                                        <span class="input-prefix">@</span>
                                        <input type="text" id="settingsUsernameInput" placeholder="knewzystreamer" autocomplete="off">
                                    </div>
                                </div>
                                <button id="settingsConnectBtn" class="btn-connect settings-connect-btn">
                                    <span class="btn-text">BAGLAN</span>
                                    <span class="btn-loader" style="display:none;">
                                        <span class="spinner"></span> Baglaniyor...
                                    </span>
                                </button>
                                <div class="connect-actions-row settings-connect-actions">
                                    <button id="settingsDisconnectBtn" class="btn-disconnect-wide" type="button">Tumunu Kes</button>
                                    <span id="settingsConnectionStateText" class="connection-state-text">Bagli degil</span>
                                </div>
                                <div id="settingsConnectError" class="error-message settings-connect-error" style="display:none;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB: BATTLE -->
                    <div class="tab-content" data-tab="battle">
                        <div class="settings-section">
                            <h3>⚔️ Top Ayarlari</h3>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>❤️ Başlangıç HP</label>
                                    <span class="setting-hint">Her oyuncu topu bu canla baslar</span>
                                </div>
                                <input type="number" id="settingDefaultHp" min="10" max="9999" value="${this.giftConfig.defaultHp}">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>⚔️ Başlangıç Saldırı Gücü</label>
                                    <span class="setting-hint">Çarpışma başına verilen hasar</span>
                                </div>
                                <input type="number" id="settingDefaultAttack" min="1" max="999" value="${this.giftConfig.defaultAttack}">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>📏 Başlangıç Boyut</label>
                                    <span class="setting-hint">1 = normal boyut</span>
                                </div>
                                <input type="number" id="settingDefaultSize" min="1" max="10" value="${this.giftConfig.defaultSize}">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>🚧 Büyüme Sınırı Aktif</label>
                                    <span class="setting-hint">Açıkken beyblade boyutu belirlenen seviyeyi geçemez</span>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="settingSizeLimitEnabled" ${this.giftConfig.sizeLimitEnabled === true ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="setting-row" id="settingSizeLimitRow">
                                <div class="setting-label">
                                    <label>📐 Maksimum Boyut Seviyesi</label>
                                    <span class="setting-hint">Sınır açıkken geçerli olur</span>
                                </div>
                                <input type="number" id="settingMaxSizeLevel" min="1" max="200" value="${Math.max(1, Math.min(200, Math.floor(Number(this.giftConfig.maxSizeLevel) || 10)))}">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>🖼️ Profil Resim Boyutu</label>
                                    <span class="setting-hint">0.2 (küçük) → 0.9 (büyük)</span>
                                </div>
                                <input type="number" id="settingProfilePicScale" min="0.2" max="0.9" step="0.05" value="${this.giftConfig.profilePicScale}">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>🖼️ Profil Resmini Goster</label>
                                    <span class="setting-hint">Oyuncu topu ustundeki profil resmini ac/kapat</span>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="settingShowProfilePic" ${this.giftConfig.showProfilePicture !== false ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>🛡️ Kalkan Süresi</label>
                                    <span class="setting-hint">Dokunulmazlık süresi (saniye)</span>
                                </div>
                                <input type="number" id="settingShieldDuration" min="1" max="60" value="${this.giftConfig.defaultShieldDuration}">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>🏆 Kazanan Geri Sayim</label>
                                    <span class="setting-hint">Son 1 kisi kaldiginda baslayan sure (saniye)</span>
                                </div>
                                <input type="number" id="settingWinnerCountdown" min="1" max="120" value="${Math.max(1, Math.min(120, Math.floor(Number(this.giftConfig.winnerCountdownSeconds) || 10)))}">
                            </div>
                        </div>
                    </div>

                    <!-- TAB: INTERACTION -->
                    <div class="tab-content" data-tab="interaction">
                        <div class="settings-section">
                            <h3>💜 TikTok Etkileşim</h3>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>👍 Beğeni Eşiği</label>
                                    <span class="setting-hint">Oyuna katılım için gereken beğeni sayısı</span>
                                </div>
                                <input type="number" id="settingLikesPerSpawn" min="1" max="1000" value="${this.giftConfig.likesPerSpawn}">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>💚 Beğeni Can Artışı</label>
                                    <span class="setting-hint">Her beğeni eşiğinde kazanılan can</span>
                                </div>
                                <input type="number" id="settingLikeHeal" min="1" max="100" value="${this.giftConfig.likeHealAmount}">
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>🎲 Beğeni Rastgele Bonus</label>
                                    <span class="setting-hint">Kapalıysa beğeni sadece can arttırır</span>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="settingLikeRandomBonus" ${this.giftConfig.enableRandomLikeBonus !== false ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>➕ Takip ile Katilim</label>
                                    <span class="setting-hint">Kapalıysa takip edenler oyuna katilmaz. Aciksa ayni kisi spam takipte tekrar sayilmaz</span>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="settingFollowSpawnEnabled" ${this.giftConfig.followSpawnEnabled !== false ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- TAB: AUDIO -->
                    <div class="tab-content" data-tab="audio">
                        <div class="settings-section">
                            <h3>🔊 Ses Efektleri</h3>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>🔊 Ses Efektleri</label>
                                    <span class="setting-hint">Çarpışma, eleme ve kazanma sesleri</span>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="settingSoundEnabled" ${window.soundManager && window.soundManager.enabled ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- TAB: SKINS -->
                    <div class="tab-content" data-tab="skins">
                        <div class="settings-section">
                            <h3>🎨 Top Gorunumu</h3>
                            <p class="skin-desc">Tum oyuncu toplarina uygulanacak gorunumu secin</p>
                            <div id="skinGrid" class="skin-grid"></div>
                        </div>
                        <div class="settings-section">
                            <h3>🏟️ Arena & Arka Plan Teması</h3>
                            <p class="skin-desc">Arena ve arka plan görünümünü seçin</p>
                            <div id="arenaThemeGrid" class="skin-grid"></div>
                        </div>
                        <div class="settings-section">
                            <h3>📐 Arena Şekli</h3>
                            <p class="skin-desc">Arena şeklini seçin</p>
                            <div id="arenaShapeGrid" class="skin-grid" style="grid-template-columns: repeat(2, 1fr);">
                                <div class="skin-card arena-shape-card ${this.giftConfig.arenaShape === 'circle' ? 'active' : ''}" data-shape="circle">
                                    <div style="font-size: 28px; margin-bottom: 6px;">⭕</div>
                                    <div style="font-weight: 600; font-size: 13px;">Daire</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">Klasik arena</div>
                                </div>
                                <div class="skin-card arena-shape-card ${this.giftConfig.arenaShape === 'rectangle' ? 'active' : ''}" data-shape="rectangle">
                                    <div style="font-size: 28px; margin-bottom: 6px;">🔲</div>
                                    <div style="font-weight: 600; font-size: 13px;">Dikdörtgen</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">Geniş alan</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB: GIFTS -->
                    <div class="tab-content" data-tab="gifts">
                        <div class="settings-section">
                            <h3>🎁 Hediye Ayarları</h3>
                            <p class="skin-desc">Hediyeyi yazmak yerine gorselden secin</p>
                            <a
                                id="giftNameSiteBtn"
                                class="btn-gift-site"
                                href="https://ademekiz1213.github.io/tiktokgiftname/"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                🔗 Hediye Isimleri Sitesini Ac
                            </a>
                            <div id="giftSettingsList" class="gift-settings-list"></div>
                            <button id="addGiftBtn" class="btn-add-gift">+ Hediye Ekle</button>
                        </div>
                    </div>

                    <!-- TAB: WINDOWS -->
                    <div class="tab-content" data-tab="windows">
                        <div class="settings-section">
                            <h3>🪟 Ayrı Pencere Araçları</h3>
                            <p class="skin-desc">Canli panelleri ayri pencere olarak acabilirsiniz.</p>
                            <button id="openPlayersPopupBtn" class="btn-open-popup">⚔️ Aktif Oyuncular — Ayrı Pencere Aç</button>
                            <button id="openPopupBtn" class="btn-open-popup">🏆 Arena Fatihleri — Ayrı Pencere Aç</button>
                            <button id="resetScoresBtn" class="btn-reset-scores">🗑️ Arena Fatihleri Sıfırla</button>
                        </div>
                    </div>

                    <!-- TAB: COMPLIANCE -->
                    <div class="tab-content" data-tab="compliance">
                        <div class="settings-section">
                            <h3>🛡️ Gizlilik Koruma</h3>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>🖼️ Profil Blur Duzeyi</label>
                                    <span class="setting-hint">Profil resimlerini bulaniklastirir</span>
                                </div>
                                <div class="range-setting-box">
                                    <input type="range" id="settingProfileBlur" min="0" max="20" step="1" value="${Math.max(0, Number(this.giftConfig.profileBlurAmount) || 0)}">
                                    <span id="settingProfileBlurValue" class="range-setting-value">${Math.max(0, Number(this.giftConfig.profileBlurAmount) || 0)} px</span>
                                </div>
                            </div>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>⏱️ Hediye Algılama Gecikmesi</label>
                                    <span class="setting-hint">Minimum 1 saniye, varsayilan 10 saniye</span>
                                </div>
                                <div class="range-setting-box">
                                    <input type="range" id="settingGiftDelay" min="1" max="120" step="1" value="${Math.max(1, Math.floor(Number(this.giftConfig.giftDetectionDelaySeconds) || 10))}">
                                    <span id="settingGiftDelayValue" class="range-setting-value">${Math.max(1, Math.floor(Number(this.giftConfig.giftDetectionDelaySeconds) || 10))} sn</span>
                                </div>
                            </div>
                        </div>
                        <div class="settings-section">
                            <h3>⚠️ Uyari</h3>
                            <p class="compliance-warning">Bu ayarlari kullanmamiz durumunda olusacak ihlallerden biz sorumlu degiliz.</p>
                        </div>
                    </div>
                </div>
                <div class="settings-footer">
                    <a id="backToDashboardBtn" href="/dashboard.html" class="btn-back-dashboard">↩ Dashboard'a Don</a>
                    <button id="saveSettingsBtn" class="btn-save-settings">💾 Kaydet</button>
                </div>
            </div>
            <div id="giftPickerModal" class="gift-picker-modal" style="display:none;">
                <div class="gift-picker-dialog">
                    <div class="gift-picker-header">
                        <h4>🎁 Hediye Sec</h4>
                        <button type="button" class="gift-picker-close">✕</button>
                    </div>
                    <div id="giftPickerGrid" class="gift-picker-grid"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        // Guide overlay
        this.guideOverlay = document.createElement('div');
        this.guideOverlay.className = 'guide-overlay';
        this.guideOverlay.style.display = 'none';
        this.guideOverlay.innerHTML = `
            <div class="guide-panel">
                <div class="guide-header">
                    <h2>📘 Oyun Rehberi</h2>
                    <button class="guide-close" type="button">✕</button>
                </div>
                <div class="guide-tabs">
                    <button class="guide-tab-btn active" data-tab="overview">🎯 Oyun Nedir?</button>
                    <button class="guide-tab-btn" data-tab="flow">⚙️ Nasil Calisir?</button>
                    <button class="guide-tab-btn" data-tab="general">🧩 Ayar Sekmeleri</button>
                    <button class="guide-tab-btn" data-tab="skins">🎨 Gorunum</button>
                    <button class="guide-tab-btn" data-tab="gifts">🎁 Hediyeler</button>
                    <button class="guide-tab-btn" data-tab="windows">🪟 Pencereler</button>
                    <button class="guide-tab-btn" data-tab="compliance">⚖️ Ihlal Koruma</button>
                </div>
                <div class="guide-body">
                    <div class="guide-tab-content active" data-tab="overview">
                        <div class="guide-section">
                            <h3>Oyunun Amaci</h3>
                            <p>
                                Bu oyun, TikTok yayinindan gelen etkilesimlerle canli bir Beyblade arenasi olusturur.
                                Yorumcular/izleyiciler oyuna katilir, toplarina hediye ve begeni ile guc verir.
                                En cok rakip eleyen oyuncular ust siralara cikar.
                            </p>
                        </div>
                        <div class="guide-section">
                            <h3>Kisa Ozet</h3>
                            <ul class="guide-list">
                                <li>Yayinci(lar)i baglarsin.</li>
                                <li>Izleyici etkilesimleri oyuna anlik yansir.</li>
                                <li>Oyuncu toplari oyuna katilir, guclenir, carpisir.</li>
                                <li>Arena Fatihleri listesi kill sayisina gore siralanir.</li>
                            </ul>
                        </div>
                    </div>

                    <div class="guide-tab-content" data-tab="flow">
                        <div class="guide-section">
                            <h3>Adim Adim Calisma Sekli</h3>
                            <ol class="guide-list guide-list-numbered">
                                <li>Oyuna premium hesabinla giris yap.</li>
                                <li>Ayarlar > Baglanti sekmesinden yayinci adlarini gir.</li>
                                <li>BAGLAN butonuyla baglantiyi ac (birden fazla yayinci girebilirsin).</li>
                                <li>Hediye ve begeniler geldikce oyuncular oyuna katilir veya guc kazanir.</li>
                                <li>Ayarlar > Hediyeler sekmesinden hangi hediyenin ne yapacagini belirle.</li>
                                <li>Canli listeleri normal panelde veya ayri pencerede takip et.</li>
                            </ol>
                        </div>
                        <div class="guide-note">
                            Not: Baglan komutu sadece kendi oturumunu etkiler. Baglantiyi kesmek de sadece senin oturumunu kapatir.
                        </div>
                    </div>

                    <div class="guide-tab-content" data-tab="general">
                        <div class="guide-section">
                            <h3>Temel Ayar Sekmeleri</h3>
                            <ul class="guide-list">
                                <li><strong>Baglanti:</strong> TikTok kullanici adlarini virgul veya boslukla girip baglanirsin. Tumunu Kes, bu oturumdaki baglantilarini kapatir.</li>
                                <li><strong>Oyun:</strong> Baslangic HP, saldiri, boyut, profil resmi boyutu, kalkan suresi ve son kisi kalinca kazanan geri sayim suresi gibi temel denge ayarlari.</li>
                                <li><strong>Etkilesim:</strong> Begeni esigi, begeniden gelen can artis miktari, rastgele bonus ac/kapat ve takip ile katilim ac/kapat secenegi.</li>
                                <li><strong>Ses:</strong> Oyun seslerini ac/kapat.</li>
                            </ul>
                        </div>
                    </div>

                    <div class="guide-tab-content" data-tab="skins">
                        <div class="guide-section">
                            <h3>Gorunum Sekmesi</h3>
                            <ul class="guide-list">
                                <li><strong>Top Gorunumu:</strong> Tum oyuncu toplarina uygulanacak skin secimi.</li>
                                <li><strong>Arena & Arka Plan Temasi:</strong> Sahnedeki renk ve stil temasini degistirir.</li>
                                <li><strong>Arena Sekli:</strong> Daire veya dikdortgen arena secimi.</li>
                            </ul>
                        </div>
                    </div>

                    <div class="guide-tab-content" data-tab="gifts">
                        <div class="guide-section">
                            <h3>Hediyeler Sekmesi</h3>
                            <ul class="guide-list">
                                <li>Hediye adini yazmak yerine listeden gorseliyle secersin.</li>
                                <li>Her hediyeye bir veya birden fazla efekt ekleyebilirsin: oyuna katil, boyut, can, guc, kalkan.</li>
                                <li>Sunucu yeni hediye gordugunde ad + gorsel kataloga kaydedilir ve tum yayincilarda kullanilabilir.</li>
                                <li>Hediye Isimleri Sitesi butonu, dis rehber sayfasini yeni sekmede acar.</li>
                            </ul>
                        </div>
                    </div>

                    <div class="guide-tab-content" data-tab="windows">
                        <div class="guide-section">
                            <h3>Pencereler Sekmesi</h3>
                            <ul class="guide-list">
                                <li><strong>Aktif Oyuncular - Ayri Pencere:</strong> Oyuncu listesini ikinci ekrana tasimak icin.</li>
                                <li><strong>Arena Fatihleri - Ayri Pencere:</strong> Skor panelini ayri bir ekranda gostermek icin.</li>
                                <li><strong>Arena Fatihleri Sifirla:</strong> Mevcut skor tablosunu temizler.</li>
                            </ul>
                        </div>
                    </div>

                    <div class="guide-tab-content" data-tab="compliance">
                        <div class="guide-section">
                            <h3>Ihlal Koruma Sekmesi</h3>
                            <ul class="guide-list">
                                <li><strong>Profil Blur Duzeyi:</strong> Profil resimlerine blur uygular.</li>
                                <li><strong>Hediye Algilama Gecikmesi:</strong> Hediye etkisini geciktirir (varsayilan 10 sn, minimum 1 sn).</li>
                                <li>Bu ayarlar istemci + sunucu davranisini birlikte etkiler.</li>
                            </ul>
                        </div>
                        <div class="guide-note guide-note-danger">
                            Uyari: Ayarlari nasil kullandiginiza bagli olusabilecek platform ihlallerinden siz sorumlusunuz.
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.guideOverlay);
    }

    _bindEvents() {
        this.settingsBtn.addEventListener('click', () => this.toggle());
        this.guideBtn.addEventListener('click', () => this.toggleGuide());
        this.overlay.querySelector('.settings-close').addEventListener('click', () => this.close());
        this.overlay.querySelector('#saveSettingsBtn').addEventListener('click', () => this._save());
        this.overlay.querySelector('#addGiftBtn').addEventListener('click', () => this._addGiftRow());
        this.overlay.querySelector('#openPlayersPopupBtn').addEventListener('click', () => {
            if (window.uiManager) window.uiManager.openActivePlayersPopup();
        });
        this.overlay.querySelector('#openPopupBtn').addEventListener('click', () => {
            if (window.uiManager) window.uiManager.openScoreboardPopup();
        });
        this.overlay.querySelector('#resetScoresBtn').addEventListener('click', () => {
            if (confirm('Tum Arena Fatihleri skorlari sifirlanacak. Emin misiniz?')) {
                if (window.game) window.game.resetScores();
            }
        });

        const giftPickerModal = this.overlay.querySelector('#giftPickerModal');
        giftPickerModal?.querySelector('.gift-picker-close')?.addEventListener('click', () => this._closeGiftPicker());
        giftPickerModal?.addEventListener('click', (e) => {
            if (e.target === giftPickerModal) this._closeGiftPicker();
        });

        const profileBlurSlider = this.overlay.querySelector('#settingProfileBlur');
        const giftDelaySlider = this.overlay.querySelector('#settingGiftDelay');
        const sizeLimitToggle = this.overlay.querySelector('#settingSizeLimitEnabled');
        profileBlurSlider?.addEventListener('input', () => {
            this._syncCompliancePreview();
            this._applyProfileBlurToDom();
        });
        giftDelaySlider?.addEventListener('input', () => this._syncCompliancePreview());
        sizeLimitToggle?.addEventListener('change', () => this._syncSizeLimitControls());

        // Tab switching
        this.overlay.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this._switchTab(tab);
            });
        });

        // Close on backdrop click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        this.guideOverlay.querySelector('.guide-close')?.addEventListener('click', () => this.closeGuide());
        this.guideOverlay.querySelectorAll('.guide-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this._switchGuideTab(btn.dataset.tab));
        });
        this.guideOverlay.addEventListener('click', (e) => {
            if (e.target === this.guideOverlay) this.closeGuide();
        });

        // Shape card click
        this.overlay.querySelectorAll('.arena-shape-card').forEach(card => {
            card.addEventListener('click', () => {
                this.overlay.querySelectorAll('.arena-shape-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.giftConfig.arenaShape = card.dataset.shape;
            });
        });

        this._syncCompliancePreview();
        this._syncSizeLimitControls();
    }

    _switchTab(tab) {
        this.activeTab = tab;
        if (tab !== 'gifts') this._closeGiftPicker();

        // Update tab buttons
        this.overlay.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update tab content
        this.overlay.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tab);
        });

        const body = this.overlay.querySelector('.settings-body');
        if (body) body.scrollTop = 0;
    }

    _switchGuideTab(tab) {
        this.activeGuideTab = tab;

        this.guideOverlay.querySelectorAll('.guide-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        this.guideOverlay.querySelectorAll('.guide-tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tab);
        });

        const guideBody = this.guideOverlay.querySelector('.guide-body');
        if (guideBody) guideBody.scrollTop = 0;
    }

    _syncCompliancePreview() {
        const blurSlider = this.overlay.querySelector('#settingProfileBlur');
        const blurValue = this.overlay.querySelector('#settingProfileBlurValue');
        const delaySlider = this.overlay.querySelector('#settingGiftDelay');
        const delayValue = this.overlay.querySelector('#settingGiftDelayValue');

        if (blurSlider && blurValue) {
            const blur = Math.max(0, Number(blurSlider.value) || 0);
            blurValue.textContent = `${Math.round(blur)} px`;
        }

        if (delaySlider && delayValue) {
            const delaySec = Math.max(1, Math.floor(Number(delaySlider.value) || 10));
            delayValue.textContent = `${delaySec} sn`;
        }
    }

    _applyProfileBlurToDom() {
        const blurSlider = this.overlay?.querySelector('#settingProfileBlur');
        const blur = blurSlider
            ? Math.max(0, Number(blurSlider.value) || 0)
            : Math.max(0, Number(this.giftConfig?.profileBlurAmount) || 0);

        document.documentElement.style.setProperty('--profile-blur-px', `${blur}px`);
    }

    _syncSizeLimitControls() {
        const toggle = this.overlay?.querySelector('#settingSizeLimitEnabled');
        const input = this.overlay?.querySelector('#settingMaxSizeLevel');
        const row = this.overlay?.querySelector('#settingSizeLimitRow');
        if (!toggle || !input) return;

        const enabled = toggle.checked;
        input.disabled = !enabled;
        if (row) {
            row.classList.toggle('is-disabled', !enabled);
        }
    }

    show() {
        this.settingsBtn.style.display = 'flex';
        this.guideBtn.style.display = 'flex';
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    toggleGuide() {
        this.guideOpen ? this.closeGuide() : this.openGuide();
    }

    open() {
        if (this.guideOpen) this.closeGuide();
        this.isOpen = true;
        this.overlay.style.display = 'flex';
        const body = this.overlay.querySelector('.settings-body');
        if (body) body.scrollTop = 0;
        this.syncFormWithConfig();
        this._renderGiftList();
        this._renderSkinGrid();
        this._renderArenaThemeGrid();
        this._syncCompliancePreview();
        this._applyProfileBlurToDom();
    }

    close() {
        this.isOpen = false;
        this._closeGiftPicker();
        this.overlay.style.display = 'none';
    }

    openGuide() {
        if (this.isOpen) this.close();
        this.guideOpen = true;
        this.guideOverlay.style.display = 'flex';
        this._switchGuideTab(this.activeGuideTab || 'overview');
    }

    closeGuide() {
        this.guideOpen = false;
        this.guideOverlay.style.display = 'none';
    }

    syncFormWithConfig() {
        if (!this.overlay || !this.giftConfig) return;

        const setValue = (selector, value) => {
            const el = this.overlay.querySelector(selector);
            if (el) el.value = String(value);
        };
        const setChecked = (selector, checked) => {
            const el = this.overlay.querySelector(selector);
            if (el) el.checked = Boolean(checked);
        };

        setValue('#settingDefaultHp', this.giftConfig.defaultHp);
        setValue('#settingDefaultAttack', this.giftConfig.defaultAttack);
        setValue('#settingDefaultSize', this.giftConfig.defaultSize);
        setChecked('#settingSizeLimitEnabled', this.giftConfig.sizeLimitEnabled === true);
        setValue('#settingMaxSizeLevel', Math.max(1, Math.floor(Number(this.giftConfig.maxSizeLevel) || 10)));
        setValue('#settingProfilePicScale', this.giftConfig.profilePicScale);
        setChecked('#settingShowProfilePic', this.giftConfig.showProfilePicture !== false);
        setValue('#settingShieldDuration', this.giftConfig.defaultShieldDuration);
        setValue('#settingWinnerCountdown', Math.max(1, Math.floor(Number(this.giftConfig.winnerCountdownSeconds) || 10)));
        setValue('#settingLikesPerSpawn', this.giftConfig.likesPerSpawn);
        setValue('#settingLikeHeal', this.giftConfig.likeHealAmount);
        setChecked('#settingLikeRandomBonus', this.giftConfig.enableRandomLikeBonus !== false);
        setChecked('#settingFollowSpawnEnabled', this.giftConfig.followSpawnEnabled !== false);
        setValue('#settingProfileBlur', Math.max(0, Number(this.giftConfig.profileBlurAmount) || 0));
        setValue('#settingGiftDelay', Math.max(1, Math.floor(Number(this.giftConfig.giftDetectionDelaySeconds) || 10)));

        this.overlay.querySelectorAll('.arena-shape-card').forEach((card) => {
            card.classList.toggle('active', card.dataset.shape === this.giftConfig.arenaShape);
        });

        this._syncCompliancePreview();
        this._syncSizeLimitControls();
        this._applyProfileBlurToDom();
    }

    // ========== SKIN GRID ==========
    _renderSkinGrid() {
        const container = this.overlay.querySelector('#skinGrid');
        if (!container || !window.Beyblade) return;

        container.innerHTML = '';
        const skins = Beyblade.SKINS;
        const currentSkin = this.giftConfig.selectedSkin || 'classic';

        for (const [id, skin] of Object.entries(skins)) {
            const card = document.createElement('div');
            card.className = `skin-card ${id === currentSkin ? 'selected' : ''}`;
            card.dataset.skinId = id;

            // Mini canvas to preview the skin
            const canvas = document.createElement('canvas');
            canvas.width = 80;
            canvas.height = 80;
            canvas.className = 'skin-preview-canvas';

            // Draw preview
            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.translate(40, 40);
            skin.draw(ctx, 30, Date.now() * 0.001);
            ctx.restore();

            card.innerHTML = `
                <div class="skin-preview-wrap"></div>
                <div class="skin-info">
                    <span class="skin-name">${skin.icon} ${skin.name}</span>
                    <span class="skin-description">${skin.desc}</span>
                </div>
            `;
            card.querySelector('.skin-preview-wrap').appendChild(canvas);

            card.addEventListener('click', () => {
                container.querySelectorAll('.skin-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.giftConfig.selectedSkin = id;
            });

            container.appendChild(card);
        }

        // Animate previews
        this._animateSkinPreviews(container);
    }

    // ========== ARENA THEME GRID ==========
    _renderArenaThemeGrid() {
        const container = this.overlay.querySelector('#arenaThemeGrid');
        if (!container || !window.Arena) return;

        container.innerHTML = '';
        const themes = Arena.THEMES;
        const currentTheme = this.giftConfig.arenaTheme || 'cyber';

        for (const [id, theme] of Object.entries(themes)) {
            const card = document.createElement('div');
            card.className = `skin-card ${id === currentTheme ? 'selected' : ''}`;
            card.dataset.themeId = id;

            // Mini canvas preview
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            canvas.className = 'skin-preview-canvas';

            // Draw preview
            const ctx = canvas.getContext('2d');
            const bgColors = theme.bgColors || ['#0f0f1e', '#050510'];
            const grad = ctx.createRadialGradient(50, 50, 0, 50, 50, 50);
            grad.addColorStop(0, bgColors[0]);
            grad.addColorStop(1, bgColors[1]);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 100, 100);
            // Draw mini arena — create mock arena for drawShapePath
            const miniArena = {
                shape: 'circle',
                centerX: 50, centerY: 50, radius: 35,
                rectW: 80, rectH: 70, rectCornerRadius: 5,
                drawShapePath(c, padding) {
                    padding = padding || 0;
                    c.beginPath();
                    c.arc(50, 50, 35 + padding, 0, Math.PI * 2);
                }
            };
            try { theme.draw(ctx, 50, 50, 35, canvas, miniArena); } catch (e) { }

            card.innerHTML = `
                <div class="skin-preview-wrap"></div>
                <div class="skin-info">
                    <span class="skin-name">${theme.icon} ${theme.name}</span>
                    <span class="skin-description">${theme.desc}</span>
                </div>
            `;
            card.querySelector('.skin-preview-wrap').appendChild(canvas);

            card.addEventListener('click', () => {
                container.querySelectorAll('.skin-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.giftConfig.arenaTheme = id;
            });

            container.appendChild(card);
        }
    }

    _animateSkinPreviews(container) {
        if (!this.isOpen) return;

        const cards = container.querySelectorAll('.skin-card');
        cards.forEach(card => {
            const canvas = card.querySelector('.skin-preview-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const skinId = card.dataset.skinId;
            const skin = Beyblade.SKINS[skinId];
            if (!skin) return;

            ctx.clearRect(0, 0, 80, 80);
            ctx.save();
            ctx.translate(40, 40);
            skin.draw(ctx, 30, Date.now() * 0.003);
            ctx.restore();
        });

        requestAnimationFrame(() => this._animateSkinPreviews(container));
    }

    _bindSocketGiftCatalogEvents() {
        if (!window.socketManager || typeof window.socketManager.on !== 'function') {
            return;
        }

        window.socketManager.on('gift-catalog-snapshot', (payload) => this._applyGiftCatalogSnapshot(payload));
        window.socketManager.on('gift-catalog-updated', (payload) => this._applyGiftCatalogUpdate(payload));

        if (window.socketManager.giftCatalogSnapshot) {
            this._applyGiftCatalogSnapshot(window.socketManager.giftCatalogSnapshot);
        }
    }

    _buildGiftCatalog() {
        const names = [
            'Balloon',
            'Cap',
            'Doughnut',
            'Finger Heart',
            'Flying Kiss',
            'Freestyle',
            'GG',
            'Galaksi',
            'Galaxy',
            'Hand Heart',
            'Hat',
            'Heart',
            'Hearts',
            'Heart Me',
            'Ice Cream',
            'Ice Cream Cone',
            'Love You',
            'Money Gun',
            'Nazar Boncugu',
            'Perfume',
            'Popular',
            'Rosa',
            'Rose',
            'Tea',
            'TikTok',
            'Turkish coffee',
            'Drama Queen',
            'Universe',
            'Swan',
            'Castle',
            'Sports Car',
            'Diamond',
            'Treasure Box',
            'Lion',
            'Fireworks'
        ];

        return names.map((name) => ({
            giftId: null,
            name,
            imageUrl: '',
            key: this._normalizeGiftKey(name)
        }));
    }

    _normalizeGiftKey(name) {
        return String(name || '').trim().toLowerCase();
    }

    _normalizeGiftImageUrl(url) {
        const normalized = String(url || '').trim();
        if (!/^https?:\/\//i.test(normalized)) return '';
        return normalized;
    }

    _mergeGiftCatalogEntries(entries) {
        if (!Array.isArray(entries) || entries.length === 0) return false;

        let changed = false;
        for (const rawEntry of entries) {
            const giftName = String(rawEntry?.giftName || rawEntry?.name || '').trim();
            if (!giftName) continue;

            const key = this._normalizeGiftKey(giftName);
            const parsedGiftId = Number(rawEntry?.giftId ?? rawEntry?.id);
            const giftId = Number.isFinite(parsedGiftId) && parsedGiftId > 0
                ? Math.floor(parsedGiftId)
                : null;
            const imageUrl = this._normalizeGiftImageUrl(
                rawEntry?.imageUrl || rawEntry?.giftPictureUrl || rawEntry?.giftImageUrl
            );

            let target = this.giftCatalog.find((entry) => entry.key === key) || null;
            if (!target && giftId) {
                target = this.giftCatalog.find((entry) => Number(entry.giftId) === giftId) || null;
            }

            if (!target) {
                this.giftCatalog.push({
                    giftId,
                    name: giftName,
                    imageUrl,
                    key
                });
                changed = true;
                continue;
            }

            if (target.name !== giftName) {
                target.name = giftName;
                changed = true;
            }

            if (giftId && Number(target.giftId) !== giftId) {
                target.giftId = giftId;
                changed = true;
            }

            if (imageUrl && target.imageUrl !== imageUrl) {
                target.imageUrl = imageUrl;
                changed = true;
            }
        }

        if (changed) {
            this.giftCatalog.sort((a, b) => String(a.name).localeCompare(String(b.name), 'tr', { sensitivity: 'base' }));
        }
        return changed;
    }

    _applyGiftCatalogSnapshot(payload) {
        const changed = this._mergeGiftCatalogEntries(payload?.gifts);
        if (changed) this._refreshGiftRowVisuals();
    }

    _applyGiftCatalogUpdate(payload) {
        const updates = payload?.gift ? [payload.gift] : [];
        const changed = this._mergeGiftCatalogEntries(updates);
        if (changed) this._refreshGiftRowVisuals();
    }

    _setGiftThumbImage(imgElement, imageUrl) {
        if (!imgElement) return;

        imgElement.onerror = () => {
            imgElement.removeAttribute('src');
            imgElement.style.display = 'none';
        };

        const normalizedUrl = this._normalizeGiftImageUrl(imageUrl);
        if (normalizedUrl) {
            imgElement.src = normalizedUrl;
            imgElement.style.display = 'block';
            return;
        }

        imgElement.removeAttribute('src');
        imgElement.style.display = 'none';
    }

    _refreshGiftRowVisuals() {
        const rows = this.overlay?.querySelectorAll('.gift-setting-row');
        if (rows) {
            rows.forEach((row) => {
                const selectedName = row.querySelector('.gift-name-input')?.value || '';
                this._setGiftRowGift(row, selectedName);
            });
        }

        if (this._giftPickerTargetRow) {
            this._renderGiftPickerOptions();
        }
    }

    _resolveGiftVisual(giftName) {
        const normalizedName = String(giftName || '').trim();
        if (!normalizedName) {
            return { name: 'Hediye sec', imageUrl: '', key: '', giftId: null };
        }

        const key = this._normalizeGiftKey(normalizedName);
        const found = this.giftCatalog.find((item) => item.key === key);
        if (found) return found;

        return {
            giftId: null,
            name: normalizedName,
            imageUrl: '',
            key
        };
    }

    _setGiftRowGift(row, giftName) {
        if (!row) return;

        const normalizedName = String(giftName || '').trim();
        const hiddenInput = row.querySelector('.gift-name-input');
        if (hiddenInput) hiddenInput.value = normalizedName;

        const visual = this._resolveGiftVisual(normalizedName);
        const pickerBtn = row.querySelector('.gift-picker-btn');
        const imageEl = row.querySelector('.gift-picker-thumb-img');
        const nameEl = row.querySelector('.gift-picker-name');

        if (pickerBtn) pickerBtn.classList.toggle('is-empty', !normalizedName);
        if (nameEl) nameEl.textContent = visual.name;
        this._setGiftThumbImage(imageEl, visual.imageUrl);
    }

    _renderGiftPickerOptions() {
        const grid = this.overlay.querySelector('#giftPickerGrid');
        if (!grid) return;

        grid.innerHTML = '';

        const selectedName = String(
            this._giftPickerTargetRow?.querySelector('.gift-name-input')?.value || ''
        ).trim();
        const selectedKey = this._normalizeGiftKey(selectedName);
        const hasCatalogMatch = this.giftCatalog.some((item) => item.key === selectedKey);

        if (selectedName && !hasCatalogMatch) {
            const customSelected = document.createElement('button');
            customSelected.type = 'button';
            customSelected.className = 'gift-picker-option selected';

            const customThumb = document.createElement('span');
            customThumb.className = 'gift-picker-option-thumb';

            const customThumbImg = document.createElement('img');
            customThumbImg.className = 'gift-picker-option-thumb-img';
            customThumbImg.alt = '';
            this._setGiftThumbImage(customThumbImg, '');
            customThumb.appendChild(customThumbImg);

            const customName = document.createElement('span');
            customName.className = 'gift-picker-option-name';
            customName.textContent = selectedName;

            customSelected.appendChild(customThumb);
            customSelected.appendChild(customName);
            customSelected.addEventListener('click', () => this._closeGiftPicker());
            grid.appendChild(customSelected);
        }

        for (const item of this.giftCatalog) {
            const optionBtn = document.createElement('button');
            optionBtn.type = 'button';
            optionBtn.className = 'gift-picker-option';
            if (item.key === selectedKey) optionBtn.classList.add('selected');

            const thumb = document.createElement('span');
            thumb.className = 'gift-picker-option-thumb';

            const thumbImg = document.createElement('img');
            thumbImg.className = 'gift-picker-option-thumb-img';
            thumbImg.alt = '';
            thumbImg.loading = 'lazy';
            thumbImg.decoding = 'async';
            thumbImg.onerror = () => {
                thumbImg.style.display = 'none';
            };
            this._setGiftThumbImage(thumbImg, item.imageUrl);
            thumb.appendChild(thumbImg);

            const name = document.createElement('span');
            name.className = 'gift-picker-option-name';
            name.textContent = item.name;

            optionBtn.appendChild(thumb);
            optionBtn.appendChild(name);
            optionBtn.addEventListener('click', () => {
                if (this._giftPickerTargetRow) {
                    this._setGiftRowGift(this._giftPickerTargetRow, item.name);
                }
                this._closeGiftPicker();
            });

            grid.appendChild(optionBtn);
        }
    }

    _openGiftPickerForRow(row) {
        this._giftPickerTargetRow = row;
        this._renderGiftPickerOptions();
        const modal = this.overlay.querySelector('#giftPickerModal');
        if (modal) modal.style.display = 'flex';
    }

    _closeGiftPicker() {
        this._giftPickerTargetRow = null;
        const modal = this.overlay.querySelector('#giftPickerModal');
        if (modal) modal.style.display = 'none';
    }

    // ========== GIFT LIST ==========
    _renderGiftList() {
        const container = this.overlay.querySelector('#giftSettingsList');
        container.innerHTML = '';

        const gifts = this.giftConfig.getAllGifts();
        for (const gift of gifts) {
            this._createGiftRow(container, gift.name, gift.effects);
        }
    }

    _createGiftRow(container, giftName, effects) {
        const row = document.createElement('div');
        row.className = 'gift-setting-row';

        let effectsHtml = effects.map((eff, idx) => `
            <div class="effect-item">
                <select class="effect-type" data-idx="${idx}">
                    <option value="spawn" ${eff.type === 'spawn' ? 'selected' : ''}>🆕 Oyuna Katıl</option>
                    <option value="size" ${eff.type === 'size' ? 'selected' : ''}>📏 Boyut</option>
                    <option value="hp" ${eff.type === 'hp' ? 'selected' : ''}>❤️ Can</option>
                    <option value="attack" ${eff.type === 'attack' ? 'selected' : ''}>💪 Güç</option>
                    <option value="shield" ${eff.type === 'shield' ? 'selected' : ''}>🛡️ Koruma</option>
                </select>
                <input type="number" class="effect-amount" value="${eff.amount}" min="1" max="100" data-idx="${idx}">
                <button class="btn-remove-effect" data-idx="${idx}">−</button>
            </div>
        `).join('');

        row.innerHTML = `
            <div class="gift-name-row">
                <button type="button" class="gift-picker-btn is-empty">
                    <span class="gift-picker-thumb">
                        <img class="gift-picker-thumb-img" alt="">
                    </span>
                    <span class="gift-picker-name">Hediye sec</span>
                    <span class="gift-picker-arrow">▾</span>
                </button>
                <input type="hidden" class="gift-name-input" value="">
                <button class="btn-delete-gift" title="Sil">🗑️</button>
            </div>
            <div class="effects-list">${effectsHtml}</div>
            <button class="btn-add-effect">+ Efekt</button>
        `;

        row.querySelector('.gift-picker-btn').addEventListener('click', () => {
            this._openGiftPickerForRow(row);
        });
        row.querySelector('.btn-delete-gift').addEventListener('click', () => {
            if (this._giftPickerTargetRow === row) this._closeGiftPicker();
            row.remove();
        });

        row.querySelector('.btn-add-effect').addEventListener('click', () => {
            const effectsList = row.querySelector('.effects-list');
            const idx = effectsList.children.length;
            const div = document.createElement('div');
            div.className = 'effect-item';
            div.innerHTML = `
                <select class="effect-type" data-idx="${idx}">
                    <option value="spawn">🆕 Oyuna Katıl</option>
                    <option value="size">📏 Boyut</option>
                    <option value="hp">❤️ Can</option>
                    <option value="attack">💪 Güç</option>
                    <option value="shield">🛡️ Koruma</option>
                </select>
                <input type="number" class="effect-amount" value="1" min="1" max="100" data-idx="${idx}">
                <button class="btn-remove-effect" data-idx="${idx}">−</button>
            `;
            div.querySelector('.btn-remove-effect').addEventListener('click', () => div.remove());
            effectsList.appendChild(div);
        });

        row.querySelectorAll('.btn-remove-effect').forEach(btn => {
            btn.addEventListener('click', () => btn.parentElement.remove());
        });

        this._setGiftRowGift(row, giftName);
        container.appendChild(row);
    }

    _addGiftRow() {
        const container = this.overlay.querySelector('#giftSettingsList');
        this._createGiftRow(container, '', [{ type: 'spawn', amount: 1 }]);
    }

    _save() {
        // Read general settings
        this.giftConfig.defaultHp = parseInt(this.overlay.querySelector('#settingDefaultHp').value) || 200;
        this.giftConfig.defaultAttack = parseInt(this.overlay.querySelector('#settingDefaultAttack').value) || 10;
        this.giftConfig.defaultSize = parseInt(this.overlay.querySelector('#settingDefaultSize').value) || 1;
        this.giftConfig.sizeLimitEnabled = this.overlay.querySelector('#settingSizeLimitEnabled')?.checked === true;
        this.giftConfig.maxSizeLevel = Math.max(
            1,
            Math.min(200, Math.floor(Number(this.overlay.querySelector('#settingMaxSizeLevel')?.value) || 10))
        );
        this.giftConfig.profilePicScale = parseFloat(this.overlay.querySelector('#settingProfilePicScale').value) || 0.6;
        this.giftConfig.showProfilePicture = this.overlay.querySelector('#settingShowProfilePic')?.checked !== false;
        this.giftConfig.profileBlurAmount = Math.max(0, Number(this.overlay.querySelector('#settingProfileBlur')?.value) || 0);
        this.giftConfig.giftDetectionDelaySeconds = Math.max(1, Math.floor(Number(this.overlay.querySelector('#settingGiftDelay')?.value) || 10));
        this.giftConfig.defaultShieldDuration = parseInt(this.overlay.querySelector('#settingShieldDuration').value) || 5;
        this.giftConfig.winnerCountdownSeconds = Math.max(
            1,
            Math.min(120, Math.floor(Number(this.overlay.querySelector('#settingWinnerCountdown')?.value) || 10))
        );
        this.giftConfig.likesPerSpawn = parseInt(this.overlay.querySelector('#settingLikesPerSpawn').value) || 50;
        this.giftConfig.likeHealAmount = parseInt(this.overlay.querySelector('#settingLikeHeal').value) || 10;
        this.giftConfig.enableRandomLikeBonus = this.overlay.querySelector('#settingLikeRandomBonus')?.checked !== false;
        this.giftConfig.followSpawnEnabled = this.overlay.querySelector('#settingFollowSpawnEnabled')?.checked !== false;
        this._syncCompliancePreview();
        this._syncSizeLimitControls();
        this._applyProfileBlurToDom();

        // Skin is already set via click handler

        // Read gift settings
        const newGifts = {};
        const rows = this.overlay.querySelectorAll('.gift-setting-row');
        for (const row of rows) {
            const nameInput = row.querySelector('.gift-name-input');
            const name = nameInput.value.trim();
            if (!name) continue;

            const effects = [];
            const effectItems = row.querySelectorAll('.effect-item');
            for (const item of effectItems) {
                const type = item.querySelector('.effect-type').value;
                const amount = parseInt(item.querySelector('.effect-amount').value) || 1;
                effects.push({ type, amount });
            }

            if (effects.length > 0) {
                newGifts[name] = { effects };
            }
        }

        this.giftConfig.gifts = newGifts;
        this.giftConfig.save();

        if (window.socketManager && typeof window.socketManager.setGiftDetectionDelay === 'function') {
            window.socketManager.setGiftDetectionDelay(this.giftConfig.giftDetectionDelaySeconds);
        }

        // Apply skin to existing beyblades
        if (window.game && window.game.beyblades) {
            window.game.beyblades.forEach(b => {
                b.skinId = this.giftConfig.selectedSkin || 'classic';
            });
        }

        // Apply arena theme
        if (window.game && window.game.arena) {
            window.game.arena.setTheme(this.giftConfig.arenaTheme || 'cyber');
            window.game.arena.setShape(this.giftConfig.arenaShape || 'circle');
        }

        // Apply sound setting
        const soundCheckbox = this.overlay.querySelector('#settingSoundEnabled');
        if (soundCheckbox && window.soundManager) {
            window.soundManager.enabled = soundCheckbox.checked;
        }

        // Show save feedback
        const saveBtn = this.overlay.querySelector('#saveSettingsBtn');
        saveBtn.textContent = '✅ Kaydedildi!';
        saveBtn.style.background = 'var(--accent-green)';
        setTimeout(() => {
            saveBtn.textContent = '💾 Kaydet';
            saveBtn.style.background = '';
        }, 1500);
    }
}

window.SettingsPanel = SettingsPanel;

