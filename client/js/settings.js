// Settings Panel - Tabbed layout with skin selector
class SettingsPanel {
    constructor(giftConfig) {
        this.giftConfig = giftConfig;
        this.isOpen = false;
        this.activeTab = 'general';
        this.giftCatalog = this._buildGiftCatalog();
        this._giftPickerTargetRow = null;
        this._createPanel();
        this._bindEvents();
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
                    <button class="tab-btn active" data-tab="general">🎮 Genel</button>
                    <button class="tab-btn" data-tab="skins">🎨 Görünüm</button>
                    <button class="tab-btn" data-tab="gifts">🎁 Hediyeler</button>
                    <button class="tab-btn" data-tab="windows">🪟 Pencereler</button>
                    <button class="tab-btn" data-tab="compliance">⚖️ Ihlal Koruma</button>
                </div>
                <div class="settings-body">
                    <!-- TAB: GENERAL -->
                    <div class="tab-content active" data-tab="general">
                        <div class="settings-section">
                            <h3>📡 Yayinci Baglanti</h3>
                            <div class="connection-settings-card">
                                <div class="input-group settings-input-group">
                                    <label for="settingsUsernameInput">TikTok Yayinci Adlari</label>
                                    <div class="input-wrapper">
                                        <span class="input-prefix">@</span>
                                        <input type="text" id="settingsUsernameInput" placeholder="yayinci1, yayinci2" autocomplete="off">
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
                                    <label>⚔️ Bazal Saldırı Gücü</label>
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
                        </div>
                        <div class="settings-section">
                            <h3>💜 TikTok Etkileşim</h3>
                            <div class="setting-row">
                                <div class="setting-label">
                                    <label>👍 Beğeni Eşiği</label>
                                    <span class="setting-hint">Spawn için gereken beğeni sayısı</span>
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
                        </div>
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
    }

    _bindEvents() {
        this.settingsBtn.addEventListener('click', () => this.toggle());
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
        profileBlurSlider?.addEventListener('input', () => {
            this._syncCompliancePreview();
            this._applyProfileBlurToDom();
        });
        giftDelaySlider?.addEventListener('input', () => this._syncCompliancePreview());

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

        // Shape card click
        this.overlay.querySelectorAll('.arena-shape-card').forEach(card => {
            card.addEventListener('click', () => {
                this.overlay.querySelectorAll('.arena-shape-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.giftConfig.arenaShape = card.dataset.shape;
            });
        });

        this._syncCompliancePreview();
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

    show() {
        this.settingsBtn.style.display = 'flex';
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        this.overlay.style.display = 'flex';
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

    _buildGiftCatalog() {
        return [
            { name: 'Rose', icon: '🌹' },
            { name: 'GG', icon: '🎉' },
            { name: 'Heart Me', icon: '💖' },
            { name: 'Finger Heart', icon: '🫶' },
            { name: 'Ice Cream Cone', icon: '🍦' },
            { name: 'Drama Queen', icon: '👑' },
            { name: 'Perfume', icon: '🧴' },
            { name: 'Hand Heart', icon: '🫰' },
            { name: 'Hat', icon: '🎩' },
            { name: 'Galaxy', icon: '🌌' },
            { name: 'Universe', icon: '🪐' },
            { name: 'TikTok', icon: '🎵' },
            { name: 'Swan', icon: '🦢' },
            { name: 'Money Gun', icon: '💸' },
            { name: 'Castle', icon: '🏰' },
            { name: 'Sports Car', icon: '🏎️' },
            { name: 'Diamond', icon: '💎' },
            { name: 'Treasure Box', icon: '🎁' },
            { name: 'Lion', icon: '🦁' },
            { name: 'Fireworks', icon: '🎆' }
        ].map((item) => ({
            ...item,
            key: this._normalizeGiftKey(item.name)
        }));
    }

    _normalizeGiftKey(name) {
        return String(name || '').trim().toLowerCase();
    }

    _resolveGiftVisual(giftName) {
        const normalizedName = String(giftName || '').trim();
        if (!normalizedName) {
            return { name: 'Hediye sec', icon: '🎁', key: '' };
        }

        const key = this._normalizeGiftKey(normalizedName);
        const found = this.giftCatalog.find((item) => item.key === key);
        if (found) return found;

        return {
            name: normalizedName,
            icon: '🎁',
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
        const iconEl = row.querySelector('.gift-picker-emoji');
        const nameEl = row.querySelector('.gift-picker-name');

        if (pickerBtn) pickerBtn.classList.toggle('is-empty', !normalizedName);
        if (iconEl) iconEl.textContent = visual.icon;
        if (nameEl) nameEl.textContent = visual.name;
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

            const customIcon = document.createElement('span');
            customIcon.className = 'gift-picker-option-emoji';
            customIcon.textContent = '🎁';

            const customName = document.createElement('span');
            customName.className = 'gift-picker-option-name';
            customName.textContent = selectedName;

            customSelected.appendChild(customIcon);
            customSelected.appendChild(customName);
            customSelected.addEventListener('click', () => this._closeGiftPicker());
            grid.appendChild(customSelected);
        }

        for (const item of this.giftCatalog) {
            const optionBtn = document.createElement('button');
            optionBtn.type = 'button';
            optionBtn.className = 'gift-picker-option';
            if (item.key === selectedKey) optionBtn.classList.add('selected');

            const icon = document.createElement('span');
            icon.className = 'gift-picker-option-emoji';
            icon.textContent = item.icon;

            const name = document.createElement('span');
            name.className = 'gift-picker-option-name';
            name.textContent = item.name;

            optionBtn.appendChild(icon);
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
                    <option value="spawn" ${eff.type === 'spawn' ? 'selected' : ''}>🆕 Spawn</option>
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
                    <span class="gift-picker-emoji">🎁</span>
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
                    <option value="spawn">🆕 Spawn</option>
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
        this.giftConfig.profilePicScale = parseFloat(this.overlay.querySelector('#settingProfilePicScale').value) || 0.6;
        this.giftConfig.showProfilePicture = this.overlay.querySelector('#settingShowProfilePic')?.checked !== false;
        this.giftConfig.profileBlurAmount = Math.max(0, Number(this.overlay.querySelector('#settingProfileBlur')?.value) || 0);
        this.giftConfig.giftDetectionDelaySeconds = Math.max(1, Math.floor(Number(this.overlay.querySelector('#settingGiftDelay')?.value) || 10));
        this.giftConfig.defaultShieldDuration = parseInt(this.overlay.querySelector('#settingShieldDuration').value) || 5;
        this.giftConfig.likesPerSpawn = parseInt(this.overlay.querySelector('#settingLikesPerSpawn').value) || 50;
        this.giftConfig.likeHealAmount = parseInt(this.overlay.querySelector('#settingLikeHeal').value) || 10;
        this._syncCompliancePreview();
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

