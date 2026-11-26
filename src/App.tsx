import React, { useState, useEffect } from 'react';
import { fetchUniverseInfo, createDeveloperProduct, createGamePass, updateDeveloperProduct, updateGamePass, listDeveloperProducts, listGamePasses, createGroupDecal, getAsset, updateDecalMetadata, BulkCreateItem, BulkAssetType } from './api';
import { KeyRound, Gamepad2, Plus, Trash2, Upload, ShieldCheck, RefreshCcw, Box, Library, Moon, Sun, Copy, FileText, Eye, EyeOff, Download, Globe, Layers } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import JSZip from 'jszip';

interface SavedExperience {
  universeId: string;
  name: string;
  iconUrl: string;
}

function App() {
  const [apiKey, setApiKey] = useState('');
  const [universeId, setUniverseId] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [devProducts, setDevProducts] = useState<BulkCreateItem[]>([]);
  const [gamePasses, setGamePasses] = useState<BulkCreateItem[]>([]);
  const [decals, setDecals] = useState<BulkCreateItem[]>([]);
  const [groupId, setGroupId] = useState(() => localStorage.getItem('rupload_group_id') || '');
  const [decalsOnlyMode, setDecalsOnlyMode] = useState(() => localStorage.getItem('rupload_decals_only_mode') === 'true');

  // Portfolio Dashboard States
  const [savedExperiences, setSavedExperiences] = useState<SavedExperience[]>(() => {
    const saved = localStorage.getItem('rupload_saved_experiences');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeUniverseId, setActiveUniverseId] = useState<string | null>(() => {
    return localStorage.getItem('rupload_active_universe_id') || null;
  });
  const [isAddingExperience, setIsAddingExperience] = useState(false);
  const [activeGameInfo, setActiveGameInfo] = useState<{name: string, iconUrl: string} | null>(null);
  const [isExportingImages, setIsExportingImages] = useState(false);
  const [isCloningConfig, setIsCloningConfig] = useState(false);
  const [cloningTargets, setCloningTargets] = useState<string[]>([]);
  const [cloneDev, setCloneDev] = useState(true);
  const [clonePasses, setClonePasses] = useState(true);

  const [activeTab, setActiveTab] = useState<BulkAssetType>('DevProduct');

  const [uploadingStates, setUploadingStates] = useState<{ [key: string]: boolean }>({});
  const handleProcessingChange = (key: string, isProcessing: boolean) => {
    setUploadingStates(prev => ({ ...prev, [key]: isProcessing }));
  };
  const isAnyUploading = Object.values(uploadingStates).some(Boolean);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isAnyUploading) {
        e.preventDefault();
        e.returnValue = 'An asset upload is currently in progress. Switching pages or closing this tab will abort the process. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAnyUploading]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('rupload_saved_experiences', JSON.stringify(savedExperiences));
  }, [savedExperiences]);

  // Auto-heal "Unknown Game" experience names in the portfolio list
  useEffect(() => {
    async function healGameName() {
      if (!activeUniverseId || !apiKey) return;
      const currentExp = savedExperiences.find(e => e.universeId === activeUniverseId);
      if (currentExp && (currentExp.name === "Unknown Game" || !currentExp.iconUrl)) {
        try {
          const info = await fetchUniverseInfo(activeUniverseId, apiKey);
          if (info.name !== "Unknown Game") {
            setSavedExperiences(prev => prev.map(exp => 
              exp.universeId === activeUniverseId 
                ? { ...exp, name: info.name, iconUrl: info.iconUrl || exp.iconUrl } 
                : exp
            ));
          }
        } catch (e) {
          console.error("Failed to auto-heal game name", e);
        }
      }
    }
    healGameName();
  }, [activeUniverseId, apiKey, savedExperiences]);

  useEffect(() => {
    if (activeUniverseId) {
      localStorage.setItem('rupload_active_universe_id', activeUniverseId);
      const exp = savedExperiences.find(e => e.universeId === activeUniverseId);
      if (exp) {
        setActiveGameInfo({ name: exp.name, iconUrl: exp.iconUrl });
      }
    } else {
      localStorage.removeItem('rupload_active_universe_id');
      setActiveGameInfo(null);
    }
  }, [activeUniverseId, savedExperiences]);

  useEffect(() => {
    localStorage.removeItem('rupload_api_key');
  }, []);

  useEffect(() => {
    localStorage.setItem('rupload_group_id', groupId);
  }, [groupId]);

  useEffect(() => {
    localStorage.setItem('rupload_decals_only_mode', decalsOnlyMode ? 'true' : 'false');
  }, [decalsOnlyMode]);

  useEffect(() => {
    if (decalsOnlyMode && !activeUniverseId) {
      setActiveTab('Decal');
    }
  }, [decalsOnlyMode, activeUniverseId]);

  // Set default active game if portfolio exists but none active
  useEffect(() => {
    if (savedExperiences.length > 0 && !activeUniverseId) {
      setActiveUniverseId(savedExperiences[0].universeId);
    }
  }, [savedExperiences, activeUniverseId]);

  const copyCombinedConfig = async () => {
    const savedDev = devProducts.filter(item => item.id && item.name.trim() !== '');
    const savedPasses = gamePasses.filter(item => item.id && item.name.trim() !== '');
    
    if (savedDev.length === 0 && savedPasses.length === 0) {
      alert("No saved assets found to copy!");
      return;
    }
    
    let textOutput = '';
    if (savedDev.length > 0) {
      textOutput += `-- Developer Products\n`;
      textOutput += savedDev.map(item => `${item.name} | ${item.price} | ${item.description || ''} | ${item.id}`).join("\n");
    }
    if (savedPasses.length > 0) {
      if (textOutput) textOutput += '\n\n';
      textOutput += `-- Game Passes\n`;
      textOutput += savedPasses.map(item => `${item.name} | ${item.price} | ${item.description || ''} | ${item.id}`).join("\n");
    }
    
    await navigator.clipboard.writeText(textOutput);
    alert("Combined config copied to clipboard!\nFormat: Name | Price | Description | ID");
  };

  const exportAllAssetsImages = async () => {
    if (!activeGameInfo) return;
    const savedDev = devProducts.filter(item => item.name.trim() !== '');
    const savedPasses = gamePasses.filter(item => item.name.trim() !== '');
    
    if (savedDev.length === 0 && savedPasses.length === 0) {
      alert("No assets found in this experience to export!");
      return;
    }
    
    setIsExportingImages(true);
    try {
      const zip = new JSZip();
      
      const devFolder = zip.folder("Developer Products");
      const passesFolder = zip.folder("Game Passes");
      
      let txtContent = `RUpload Config Backup for: ${activeGameInfo.name}\n`;
      txtContent += `Universe ID: ${activeUniverseId}\n`;
      txtContent += `Export Date: ${new Date().toLocaleString()}\n\n`;
      
      const fetchAndAddToZip = async (item: BulkCreateItem, folder: JSZip | null) => {
        const cleanName = item.name.replace(/[\/\\?%*:|"<>]/g, '-').trim();
        
        // Try local file first
        if (item.imageFile) {
          folder?.file(`${cleanName}.png`, item.imageFile);
          return;
        }
        
        // If not local file, fetch remote iconUrl
        if (item.iconUrl) {
          try {
            const res = await fetch(item.iconUrl);
            if (res.ok) {
              const blob = await res.blob();
              folder?.file(`${cleanName}.png`, blob);
            }
          } catch (e) {
            console.error(`Failed to fetch icon for ${item.name}:`, e);
          }
        }
      };

      // Add dev products
      if (savedDev.length > 0) {
        txtContent += `[Developer Products]\n`;
        txtContent += savedDev.map(item => `${item.name} | ${item.price} | ${item.id || 'Not Saved'}`).join("\n") + "\n\n";
        
        await Promise.all(
          savedDev.map(item => fetchAndAddToZip(item, devFolder))
        );
      }
      
      // Add game passes
      if (savedPasses.length > 0) {
        txtContent += `[Game Passes]\n`;
        txtContent += savedPasses.map(item => `${item.name} | ${item.price} | ${item.id || 'Not Saved'}`).join("\n") + "\n\n";
        
        await Promise.all(
          savedPasses.map(item => fetchAndAddToZip(item, passesFolder))
        );
      }
      
      // Add metadata sheet text file
      zip.file("metadata.txt", txtContent);
      
      // Generate zip file
      const content = await zip.generateAsync({ type: "blob" });
      
      // Trigger download
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${activeGameInfo.name.replace(/[\/\\?%*:|"<>]/g, '-')}-assets.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert("Asset images and config details successfully exported into a single ZIP archive!");
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExportingImages(false);
    }
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDark]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !universeId) return;
    setLoadingConfig(true);
    setConfigError('');
    try {
      const info = await fetchUniverseInfo(universeId, apiKey);
      
      setSavedExperiences(prev => {
        const exists = prev.some(e => e.universeId === universeId);
        if (exists) return prev;
        return [...prev, { universeId, name: info.name, iconUrl: info.iconUrl }];
      });
      
      setActiveUniverseId(universeId);
      setUniverseId('');
      setIsAddingExperience(false);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Invalid Universe ID or API Key');
    } finally {
      setLoadingConfig(false);
    }
  };

  const openDecalUploader = () => {
    if (!apiKey || !groupId) return;
    setConfigError('');
    setDecalsOnlyMode(true);
    setActiveUniverseId(null);
    setActiveTab('Decal');
    setIsAddingExperience(false);
  };

  const cloneConfigToExperiences = () => {
    if (cloningTargets.length === 0) {
      alert("Please select at least one target game to clone to!");
      return;
    }
    if (!cloneDev && !clonePasses) {
      alert("Please select at least one asset type (Developer Products and/or Game Passes) to clone!");
      return;
    }
    if (!activeUniverseId) return;

    // Get current lists in localStorage for activeUniverseId
    const currentDevSaved = localStorage.getItem(`rupload_items_${activeUniverseId}_DevProduct`);
    const currentPassesSaved = localStorage.getItem(`rupload_items_${activeUniverseId}_GamePass`);

    for (const targetId of cloningTargets) {
      if (cloneDev && currentDevSaved) {
        try {
          const parsed = JSON.parse(currentDevSaved) as BulkCreateItem[];
          // Strip active Roblox IDs so they become clean new upload drafts in the target experience
          const cloned = parsed.map(item => ({
            ...item,
            id: undefined,
            isExisting: false,
            isDirty: true
          }));
          localStorage.setItem(`rupload_items_${targetId}_DevProduct`, JSON.stringify(cloned));
        } catch (e) {
          console.error("Failed to clone DevProducts:", e);
        }
      }
      if (clonePasses && currentPassesSaved) {
        try {
          const parsed = JSON.parse(currentPassesSaved) as BulkCreateItem[];
          // Strip active Roblox IDs so they become clean new upload drafts in the target experience
          const cloned = parsed.map(item => ({
            ...item,
            id: undefined,
            isExisting: false,
            isDirty: true
          }));
          localStorage.setItem(`rupload_items_${targetId}_GamePass`, JSON.stringify(cloned));
        } catch (e) {
          console.error("Failed to clone GamePasses:", e);
        }
      }
    }

    alert(`Successfully cloned configuration drafts to selected experience dashboards! Stripped Roblox IDs so they are ready to upload as brand-new assets.`);
    setCloningTargets([]);
    setIsCloningConfig(false);
  };

  const removeExperience = (univId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to remove this game from your dashboard?")) {
      setSavedExperiences(prev => prev.filter(item => item.universeId !== univId));
      if (activeUniverseId === univId) {
        setActiveUniverseId(null);
      }
    }
  };

  const handleGoToRCount = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (window.location.hostname === 'localhost') {
      window.location.href = 'http://localhost:3000';
      return;
    }
    if (e.shiftKey) {
      const customUrl = prompt("Configure RCount URL (leave blank to reset):", localStorage.getItem('rcount_partner_url') || '');
      if (customUrl === '') {
        localStorage.removeItem('rcount_partner_url');
        alert('Reset RCount link to default.');
      } else if (customUrl) {
        let formatted = customUrl;
        if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
          formatted = 'https://' + formatted;
        }
        localStorage.setItem('rcount_partner_url', formatted);
        alert(`Set RCount partner URL to: ${formatted}`);
      }
      return;
    }
    const partnerUrl = localStorage.getItem('rcount_partner_url') || 'https://rcounticon.netlify.app';
    window.location.href = partnerUrl;
  };

  return (
    <>
      <div className="mesh-bg" />
      
      <header className="app-header">
        <div className="logo-wrapper">
          <div className="logo-icon">
            <ShieldCheck size={24} />
          </div>
          <div className="logo-text">
            <h1>RUpload</h1>
            <p>ROBLOX BULK UPLOADER</p>
          </div>
        </div>
        
        <div className="flex-row" style={{ gap: '1rem' }}>
          <a href="/countdown-scheduler" onClick={handleGoToRCount} className="btn btn-secondary flex-row" style={{ gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', textDecoration: 'none', color: 'inherit', width: 'auto' }} title="Go to RCount countdown icon scheduler">
            <Layers size={14} />
            <span>Go to RCount</span>
          </a>
          <button onClick={() => setIsDark(!isDark)} className="btn-icon" title="Toggle Theme">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {activeGameInfo && (
            <>
              <div className="game-badge">
                {activeGameInfo.iconUrl ? (
                  <img src={activeGameInfo.iconUrl} alt="Game Icon" />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Gamepad2 size={16} color="var(--text-muted)" />
                  </div>
                )}
                <span>{activeGameInfo.name}</span>
              </div>
              <button 
                onClick={exportAllAssetsImages} 
                className="btn btn-secondary" 
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                disabled={isExportingImages || isAnyUploading}
              >
                {isExportingImages ? (
                  <RefreshCcw size={14} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Download size={14} />
                )}
                <span>Export All Assets (.zip)</span>
              </button>
              <button 
                onClick={() => {
                  if (!isAnyUploading) {
                    setCloningTargets([]);
                    setCloneDev(true);
                    setClonePasses(true);
                    setIsCloningConfig(true);
                  }
                }}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', gap: '0.4rem', display: 'inline-flex', alignItems: 'center', ...(isAnyUploading ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' } : {}) }}
              >
                <Layers size={14} />
                <span>Clone Config to...</span>
              </button>
              <button 
                onClick={copyCombinedConfig} 
                className="btn btn-primary" 
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', ...(isAnyUploading ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' } : {}) }}
              >
                <Copy size={14} /> Copy Combined Config
              </button>
              <button 
                onClick={() => {
                  if (!isAnyUploading && confirm("Disconnect and clear all saved experience dashboards?")) {
                    setSavedExperiences([]);
                    setActiveUniverseId(null);
                    setApiKey('');
                    for (const key of Object.keys(localStorage)) {
                      if (key.startsWith('rupload_') || key === 'rcount_partner_url') {
                        localStorage.removeItem(key);
                      }
                    }
                  }
                }} 
                className="btn btn-secondary"
                style={isAnyUploading ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
              >
                Reset All
              </button>
            </>
          )}
        </div>
      </header>

      <main className="container" style={{ maxWidth: '1400px' }}>
        <AnimatePresence mode="wait">
          {savedExperiences.length === 0 && !decalsOnlyMode ? (
            <motion.div 
              key="config"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <div className="glass-box centered">
                <h2 className="box-title">Connect API</h2>
                <p className="box-subtitle">
                  Enter your Roblox Open Cloud credentials.
                </p>

                <form onSubmit={handleConnect} className="form-group">
                  <div className="input-field">
                    <label className="input-label">
                      <KeyRound size={16} /> API Key
                    </label>
                    <input 
                      type="password" 
                      className="input" 
                      placeholder="Enter Roblox API Key"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      required
                    />
                  </div>
                  
                  <div className="input-field">
                    <label className="input-label">
                      <Gamepad2 size={16} /> Universe ID
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. 1234567890"
                      value={universeId}
                      onChange={e => setUniverseId(e.target.value)}
                      required
                    />
                  </div>

                  {configError && (
                    <div className="alert-error">
                      {configError}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ marginTop: '1rem', width: '100%', padding: '1rem' }}
                    disabled={loadingConfig || !apiKey || !universeId}
                  >
                    {loadingConfig ? <RefreshCcw size={20} style={{ animation: 'spin 1s linear infinite' }} /> : 'Connect Experience'}
                  </button>
                </form>

                <div className="auth-divider">
                  <span>or</span>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div className="input-field">
                    <label className="input-label">
                      <Upload size={16} /> Group ID
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. 7654321"
                      value={groupId}
                      onChange={e => setGroupId(e.target.value.replace(/[^\d]/g, ''))}
                    />
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '1rem' }}
                    disabled={!apiKey || !groupId}
                    onClick={openDecalUploader}
                  >
                    <Upload size={18} />
                    <span>Open Decal Uploader</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="app-body"
            >
              <aside className="sidebar">
                <div className="sidebar-title">
                  {isAnyUploading ? <RefreshCcw size={20} className="spinner" style={{ animation: 'spin 1s linear infinite' }} /> : decalsOnlyMode && savedExperiences.length === 0 ? <Upload size={20} color="var(--primary)" /> : <Gamepad2 size={20} color="var(--primary)" />}
                  <span>{decalsOnlyMode && savedExperiences.length === 0 ? 'Decal Upload' : 'My Portfolio'} {isAnyUploading && "(Uploading...)"}</span>
                </div>
                
                <div className="portfolio-list">
                  {decalsOnlyMode && savedExperiences.length === 0 && (
                    <div className="game-card-btn active">
                      <div className="game-card-info">
                        <div className="game-card-icon-fallback">
                          <Upload size={16} />
                        </div>
                        <div className="game-card-details">
                          <span className="game-card-name">Group Decals</span>
                          <span className="game-card-id">Group: {groupId}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {savedExperiences.map(exp => (
                    <div 
                      key={exp.universeId} 
                      className={`game-card-btn ${activeUniverseId === exp.universeId ? 'active' : ''}`}
                      onClick={() => {
                        if (!isAnyUploading) {
                          setActiveUniverseId(exp.universeId);
                        }
                      }}
                      style={isAnyUploading ? { opacity: 0.6, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
                    >
                      <div className="game-card-info">
                        {exp.iconUrl ? (
                          <img src={exp.iconUrl} className="game-card-icon" alt="Game Icon" />
                        ) : (
                          <div className="game-card-icon-fallback">
                            <Gamepad2 size={16} />
                          </div>
                        )}
                        <div className="game-card-details">
                          <span className="game-card-name" title={exp.name}>{exp.name}</span>
                          <span className="game-card-id">ID: {exp.universeId}</span>
                        </div>
                      </div>
                      
                      {!isAnyUploading && (
                        <button 
                          className="game-card-remove-btn" 
                          title="Remove Game"
                          onClick={(e) => removeExperience(exp.universeId, e)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <button 
                  className="btn-add-experience"
                  onClick={() => {
                    if (!isAnyUploading) {
                      setConfigError('');
                      setIsAddingExperience(true);
                    }
                  }}
                  style={isAnyUploading ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
                >
                  <Plus size={16} /> Add Experience
                </button>
              </aside>

              <div className="main-content">
                {(activeUniverseId || decalsOnlyMode) && (
                  <>
                    {/* Premium Sticky Tabs Bar */}
                    <div className="workspace-tabs-container">
                      <div className="workspace-tabs">
                        {activeUniverseId && (
                          <>
                            <button 
                              className={`workspace-tab-btn ${activeTab === 'DevProduct' ? 'active' : ''}`}
                              onClick={() => setActiveTab('DevProduct')}
                            >
                              <Box size={16} />
                              <span>Developer Products</span>
                              <span className="tab-badge">{devProducts.filter(i => i.name.trim() !== '').length}</span>
                            </button>
                            <button 
                              className={`workspace-tab-btn ${activeTab === 'GamePass' ? 'active' : ''}`}
                              onClick={() => setActiveTab('GamePass')}
                            >
                              <Library size={16} />
                              <span>Game Passes</span>
                              <span className="tab-badge">{gamePasses.filter(i => i.name.trim() !== '').length}</span>
                            </button>
                          </>
                        )}
                        <button 
                          className={`workspace-tab-btn ${activeTab === 'Decal' ? 'active' : ''}`}
                          onClick={() => setActiveTab('Decal')}
                        >
                          <Upload size={16} />
                          <span>Decals</span>
                          <span className="tab-badge">{decals.filter(i => i.name.trim() !== '').length}</span>
                        </button>
                      </div>
                    </div>

                    {activeUniverseId && (
                      <>
                    <div style={{ display: activeTab === 'DevProduct' ? 'block' : 'none' }}>
                      <BulkCreator 
                        key={`dev-${activeUniverseId}`}
                        apiKey={apiKey} 
                        universeId={activeUniverseId} 
                        type="DevProduct" 
                        onItemsLoaded={(_, loadedItems) => setDevProducts(loadedItems)} 
                        onProcessingChange={(p) => handleProcessingChange('dev', p)}
                      />
                    </div>
                    <div style={{ display: activeTab === 'GamePass' ? 'block' : 'none' }}>
                      <BulkCreator 
                        key={`pass-${activeUniverseId}`}
                        apiKey={apiKey} 
                        universeId={activeUniverseId} 
                        type="GamePass" 
                        onItemsLoaded={(_, loadedItems) => setGamePasses(loadedItems)} 
                        onProcessingChange={(p) => handleProcessingChange('pass', p)}
                      />
                    </div>
                      </>
                    )}
                    <div style={{ display: activeTab === 'Decal' ? 'block' : 'none' }}>
                      <BulkCreator 
                        key={`decal-${activeUniverseId || 'standalone'}`}
                        apiKey={apiKey} 
                        universeId={activeUniverseId || 'decals-only'}
                        groupId={groupId}
                        onGroupIdChange={setGroupId}
                        type="Decal" 
                        onItemsLoaded={(_, loadedItems) => setDecals(loadedItems)} 
                        onProcessingChange={(p) => handleProcessingChange('decals', p)}
                      />
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isAddingExperience && (
        <div className="modal-overlay" onClick={() => setIsAddingExperience(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <h4 className="modal-title">Add New Experience</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Enter the Universe ID of another Roblox game to add it to your active portfolio list.
            </p>
            
            <form onSubmit={handleConnect} className="form-group" style={{ marginBottom: 0 }}>
              <div className="input-field">
                <label className="input-label">
                  <KeyRound size={16} /> API Key
                </label>
                <input 
                  type="password" 
                  className="input" 
                  placeholder="Roblox API Key"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </div>
              
              <div className="input-field">
                <label className="input-label">
                  <Gamepad2 size={16} /> Universe ID
                </label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. 1234567890"
                  value={universeId}
                  onChange={e => setUniverseId(e.target.value)}
                  required
                />
              </div>

              {configError && (
                <div className="alert-error" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  {configError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsAddingExperience(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loadingConfig || !apiKey || !universeId}
                >
                  {loadingConfig ? <RefreshCcw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Add Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clone Config Modal popup */}
      {isCloningConfig && activeGameInfo && (
        <div className="modal-overlay" onClick={() => setIsCloningConfig(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h4 className="modal-title">Clone Configuration to Portfolio</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Copy the entire draft configuration of <strong>{activeGameInfo.name}</strong> to other games. Stripped existing IDs so they are prepared as brand-new assets in the target games.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select Asset Types:</span>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <label className="flex-row" style={{ gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="checkbox" 
                    checked={cloneDev} 
                    onChange={e => setCloneDev(e.target.checked)} 
                  />
                  <span>Developer Products</span>
                </label>
                <label className="flex-row" style={{ gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="checkbox" 
                    checked={clonePasses} 
                    onChange={e => setClonePasses(e.target.checked)} 
                  />
                  <span>Game Passes</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select Target Games:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
                {savedExperiences
                  .filter(exp => exp.universeId !== activeUniverseId)
                  .map(exp => (
                    <label 
                      key={exp.universeId} 
                      className="flex-row" 
                      style={{ padding: '0.4rem', gap: '0.75rem', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      <input 
                        type="checkbox" 
                        checked={cloningTargets.includes(exp.universeId)} 
                        onChange={e => {
                          if (e.target.checked) {
                            setCloningTargets(prev => [...prev, exp.universeId]);
                          } else {
                            setCloningTargets(prev => prev.filter(id => id !== exp.universeId));
                          }
                        }}
                      />
                      {exp.iconUrl ? (
                        <img src={exp.iconUrl} style={{ width: '24px', height: '24px', borderRadius: '50%' }} alt="icon" />
                      ) : (
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px dashed var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Gamepad2 size={12} />
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>{exp.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {exp.universeId}</span>
                      </div>
                    </label>
                  ))}
                {savedExperiences.filter(exp => exp.universeId !== activeUniverseId).length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', width: '100%' }}>
                    No other games saved in your portfolio. Add another game to copy configurations!
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setCloningTargets([]);
                  setIsCloningConfig(false);
                }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={cloneConfigToExperiences}
                disabled={cloningTargets.length === 0 || (!cloneDev && !clonePasses)}
              >
                Clone Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;


// --- Subcomponent ---

function emptyItem(): BulkCreateItem {
  return { name: '', description: '', price: 0, isRegionalPricingEnabled: false, imageFile: null };
}

function parseBulkText(text: string, isDecalMode = false): { name: string; price: number; description: string; id?: string }[] {
  const lines = text.split('\n');
  const results: { name: string; price: number; description: string; id?: string }[] = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    let parts: string[] = [];
    if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes('|')) {
      parts = line.split('|');
    } else if (line.includes(',')) {
      parts = line.split(',');
    } else {
      parts = [line];
    }
    
    const name = parts[0]?.trim() || '';
    if (!name) continue;
    
    if (name.toLowerCase() === 'name' && (parts[1]?.toLowerCase().includes('price') || parts[1]?.toLowerCase().includes('description'))) {
      continue;
    }

    if (isDecalMode) {
      let description = parts[1]?.trim() || '';
      const id = parts.slice(2).map(part => part.trim()).find(part => /^\d{8,}$/.test(part));
      if (description.startsWith('"') && description.endsWith('"')) {
        description = description.slice(1, -1).trim();
      }
      if (/^\d+$/.test(description) && description.length >= 8) {
        description = '';
      }
      results.push({ name, price: 0, description, id });
      continue;
    }
    
    let price = 0;
    let description = '';
    
    if (parts.length > 1) {
      const priceStr = parts[1].replace(/[^\d]/g, '');
      price = parseInt(priceStr) || 0;
    }
    const id = parts.slice(2).map(part => part.trim()).find(part => /^\d{8,}$/.test(part));
    if (parts.length > 2) {
      const descriptionParts = id ? parts.slice(2).filter(part => part.trim() !== id) : parts.slice(2);
      description = descriptionParts.join(',').trim();
      if (description.startsWith('"') && description.endsWith('"')) {
        description = description.slice(1, -1).trim();
      }
      // Strip purely numeric Roblox Asset IDs (length >= 8) so they do not override the description field
      if (/^\d+$/.test(description) && description.length >= 8) {
        description = '';
      }
    }
    
    results.push({ name, price, description, id });
  }
  
  return results;
}

function BulkCreator({ apiKey, universeId, groupId = '', onGroupIdChange, type, onItemsLoaded, onProcessingChange }: { apiKey: string, universeId: string, groupId?: string, onGroupIdChange?: (groupId: string) => void, type: BulkAssetType, onItemsLoaded?: (type: BulkAssetType, items: BulkCreateItem[]) => void, onProcessingChange?: (processing: boolean) => void }) {
  const storageScope = type === 'Decal' ? (groupId || 'unconfigured-group') : universeId;
  const isDecalMode = type === 'Decal';
  const [items, setItems] = useState<BulkCreateItem[]>(() => {
    const saved = localStorage.getItem(`rupload_items_${storageScope}_${type}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as BulkCreateItem[];
        if (isDecalMode) {
          return parsed.map(item => item.id ? { ...item, isExisting: true } : item);
        }
        return parsed;
      } catch (e) {
        console.error("Failed to parse saved items", e);
      }
    }
    return [emptyItem()];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{item: BulkCreateItem, success: boolean, data?: any, error?: string}[] | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [showExisting, setShowExisting] = useState(true);

  useEffect(() => {
    if (onItemsLoaded) {
      onItemsLoaded(type, items);
    }
  }, [items, type, onItemsLoaded]);

  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(isProcessing);
    }
    return () => {
      if (onProcessingChange) {
        onProcessingChange(false);
      }
    };
  }, [isProcessing, onProcessingChange]);

  const copyConfig = async () => {
    const validItems = items.filter(item => item.name.trim() !== '');
    if (validItems.length === 0) {
      alert(`No assets found in this list to copy!`);
      return;
    }
    const lines = validItems.map(item => isDecalMode ? `${item.name} | ${item.description || ''} | ${item.id || ''}` : `${item.name} | ${item.price} | ${item.description || ''} | ${item.id || ''}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    alert(`${isDecalMode ? 'Decals' : type === 'DevProduct' ? 'Developer Products' : 'Game Passes'} config copied to clipboard!\nFormat: ${isDecalMode ? 'Name | Description | ID' : 'Name | Price | Description | ID'}`);
  };

  useEffect(() => {
    async function loadData() {
      const saved = localStorage.getItem(`rupload_items_${storageScope}_${type}`);
      if (isDecalMode) {
        setLoadingInitial(false);
        return;
      }
      if (!saved) {
        try {
          const fetched = type === 'DevProduct' ? await listDeveloperProducts(apiKey, universeId) : await listGamePasses(apiKey, universeId);
          if (fetched.length > 0) {
            const initialItems = [...fetched, emptyItem()];
            setItems(initialItems);
            localStorage.setItem(`rupload_items_${storageScope}_${type}`, JSON.stringify(initialItems.map(i => ({ ...i, imageFile: null }))));
          } else {
            setItems([emptyItem()]);
          }
        } catch (err) {
          console.error("Failed to load existing", err);
        } finally {
          setLoadingInitial(false);
        }
      } else {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, [apiKey, universeId, storageScope, type, isDecalMode]);

  // Autosave items to localStorage
  useEffect(() => {
    if (!loadingInitial) {
      const serialized = JSON.stringify(items.map(item => ({
        ...item,
        imageFile: null // Strip File objects since they cannot be serialized
      })));
      localStorage.setItem(`rupload_items_${storageScope}_${type}`, serialized);
    }
  }, [items, storageScope, type, loadingInitial]);

  const syncFromRoblox = async () => {
    if (isDecalMode) return;
    if (confirm(`Are you sure you want to discard your unsaved draft for ${type === 'DevProduct' ? 'Developer Products' : 'Game Passes'} and pull the latest online list from Roblox?`)) {
      setLoadingInitial(true);
      localStorage.removeItem(`rupload_items_${storageScope}_${type}`);
      try {
        const fetched = type === 'DevProduct' ? await listDeveloperProducts(apiKey, universeId) : await listGamePasses(apiKey, universeId);
        if (fetched.length > 0) {
          const initialItems = [...fetched, emptyItem()];
          setItems(initialItems);
          localStorage.setItem(`rupload_items_${storageScope}_${type}`, JSON.stringify(initialItems.map(i => ({ ...i, imageFile: null }))));
        } else {
          setItems([emptyItem()]);
        }
      } catch (err) {
        alert(`Failed to sync from Roblox: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoadingInitial(false);
      }
    }
  };

  const toggleAllRegionalPricing = () => {
    const allEnabled = items.every(i => i.isRegionalPricingEnabled);
    setItems(items.map(item => ({
      ...item,
      isRegionalPricingEnabled: !allEnabled,
      isDirty: true
    })));
  };

  const addItem = () => setItems([...items, emptyItem()]);

  const addDecalFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems = Array.from(files).map(file => ({
      name: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || file.name,
      description: '',
      price: 0,
      isRegionalPricingEnabled: false,
      imageFile: file,
      isDirty: true
    }));

    setItems(prevItems => {
      const withoutEmptyDraft = prevItems.filter(item => item.name.trim() !== '' || item.imageFile || item.isExisting);
      return [...withoutEmptyDraft, ...newItems, emptyItem()];
    });
  };

  const hydrateDecalRows = async (rows: BulkCreateItem[]) => {
    const rowsWithIds = rows.filter(row => row.id);
    if (!isDecalMode || rowsWithIds.length === 0) return rows;

    const hydrated = rows.map(row => ({ ...row }));
    const chunkSize = 100;

    for (let i = 0; i < rowsWithIds.length; i += chunkSize) {
      const chunk = rowsWithIds.slice(i, i + chunkSize);
      const ids = chunk.map(row => row.id).join(",");
      try {
        const iconRes = await fetch(`/api/thumbnails/v1/assets?assetIds=${ids}&size=150x150&format=Png`);
        if (iconRes.ok) {
          const iconData = await iconRes.json();
          for (const thumb of iconData.data || []) {
            const row = hydrated.find(item => item.id === String(thumb.targetId));
            if (row && thumb.imageUrl) row.iconUrl = thumb.imageUrl;
          }
        }
      } catch (e) {
        console.error("Failed to load decal thumbnails", e);
      }
    }

    await Promise.all(rowsWithIds.map(async rowWithId => {
      try {
        const asset = await getAsset(apiKey, rowWithId.id!);
        const row = hydrated.find(item => item.id === rowWithId.id);
        if (!row) return;
        row.description = row.description || asset.description || "";
        if (!row.name.trim()) row.name = asset.displayName || "";
      } catch (e) {
        console.error(`Failed to load decal ${rowWithId.id}`, e);
      }
    }));

    return hydrated;
  };
  
  const removeItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<BulkCreateItem>) => {
    setItems(items.map((item, i) => i === index ? { ...item, ...updates, isDirty: true } : item));
  };

  const handleUploadClick = (index: number) => {
    const el = document.getElementById(`file-${type}-${index}`);
    if (el) el.click();
  };

  const copyResults = async () => {
    if (!results) return;
    const lines = results.map(r => {
      const id = r.success ? (r.data?.[type === 'DevProduct' ? 'productId' : type === 'GamePass' ? 'gamePassId' : 'assetId'] ?? 'Ok') : `Error: ${r.error}`;
      return isDecalMode ? `Name: ${r.item.name} | Status: ${id}` : `Name: ${r.item.name} | Price: ${r.item.price} R$ | Status: ${id}`;
    });
    await navigator.clipboard.writeText(lines.join("\n"));
    alert("Copied to clipboard!");
  };

  const handleSubmit = async () => {
    // Only new items or modified (dirty) existing items are eligible for upload/update
    const validItems = items.filter(i => i.name.trim() !== '' && (!i.isExisting || i.isDirty));
    if (validItems.length === 0) return;
    if (isDecalMode && validItems.some(item => !item.isExisting) && !groupId.trim()) {
      alert("Please enter a Roblox Group ID before uploading new decals.");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults(null);

    const outResults: { item: BulkCreateItem; success: boolean; data?: any; error?: string; }[] = [];
    
    for (let i = 0; i < validItems.length; i++) {
       const item = validItems[i];
       try {
         let res;
         if (item.isExisting && item.id) {
            if (isDecalMode) {
              res = await updateDecalMetadata(apiKey, item.id, item);
              res = { ...res, assetId: item.id };
            } else {
              res = type === 'DevProduct' 
                ? await updateDeveloperProduct(apiKey, universeId, item.id, item)
                : await updateGamePass(apiKey, universeId, item.id, item);
              res = { ...res, [type === 'DevProduct' ? 'productId' : 'gamePassId']: item.id };
            }
         } else {
            let uploadItem = { ...item };
            if (!item.imageFile && item.iconUrl) {
              try {
                const response = await fetch(item.iconUrl);
                if (response.ok) {
                  const blob = await response.blob();
                  const file = new File([blob], `${item.name.replace(/[^a-zA-Z0-9]/g, "_")}.png`, { type: "image/png" });
                  uploadItem.imageFile = file;
                }
              } catch (e) {
                console.error(`Failed to carry over icon from URL for ${item.name}:`, e);
              }
            }
            if (isDecalMode) {
              res = await createGroupDecal(apiKey, groupId.trim(), uploadItem);
            } else {
              res = type === 'DevProduct' 
                ? await createDeveloperProduct(apiKey, universeId, uploadItem)
                : await createGamePass(apiKey, universeId, uploadItem);
            }
         }
         outResults.push({ item, success: true, data: res });
       } catch (err) {
         outResults.push({ item, success: false, error: err instanceof Error ? err.message : String(err) });
       }
       setProgress(Math.round(((i + 1) / validItems.length) * 100));
       await new Promise(r => setTimeout(r, 600));
    }

    // Update the main items array so successful creations are marked as existing!
    setItems(prevItems => prevItems.map(originalItem => {
       const resultMatch = outResults.find(r => r.item === originalItem);
       if (resultMatch && resultMatch.success) {
          const newId = resultMatch.data?.[type === 'DevProduct' ? 'productId' : type === 'GamePass' ? 'gamePassId' : 'assetId'];
          return { ...originalItem, isExisting: true, id: newId, isDirty: false };
       }
       return originalItem;
    }));

    setResults(outResults);
    setIsProcessing(false);
  };

  const title = type === 'DevProduct' ? 'Developer Products' : type === 'GamePass' ? 'Game Passes' : 'Group Decals';
  const Icon = type === 'DevProduct' ? Box : type === 'GamePass' ? Library : Upload;
  const pendingItemCount = items.filter(i => i.name.trim() !== '' && (!i.isExisting || i.isDirty)).length;
  const hasPendingNewDecals = isDecalMode && items.some(i => i.name.trim() !== '' && !i.isExisting);

  if (loadingInitial) {
    return (
      <div className="glass-box" style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
         <RefreshCcw size={32} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="glass-box">
      {isDecalMode && (
        <input
          type="file"
          id="decal-files-input"
          style={{ display: 'none' }}
          accept=".png,.jpg,.jpeg,.bmp,.tga"
          multiple
          onChange={e => {
            addDecalFiles(e.target.files);
            e.target.value = '';
          }}
        />
      )}
      <div className="list-header">
        <h3 className="list-title">
          <div className="list-decorator" />
          <Icon size={24} color="var(--primary)" />
          {title}
        </h3>
        
        {results === null && !isProcessing && (
          <div className="list-actions-toolbar">
            <div className="toolbar-group">
              <button 
                onClick={() => setShowExisting(!showExisting)} 
                className={`toolbar-btn ${!showExisting ? 'active' : ''}`}
                title={showExisting ? "Hide Existing Assets" : "Show Existing Assets"}
              >
                {showExisting ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <button 
                onClick={copyConfig} 
                className="toolbar-btn" 
                title={isDecalMode ? "Copy Config (Name | Description | ID)" : "Copy Config (Name | Price | Description | ID)"}
              >
                <Copy size={18} />
              </button>
              {!isDecalMode && (
                <>
                  <button 
                    onClick={syncFromRoblox} 
                    className="toolbar-btn" 
                    title="Sync from Roblox (Discards Unsaved Draft)"
                  >
                    <RefreshCcw size={18} />
                  </button>
                  <button 
                    onClick={toggleAllRegionalPricing} 
                    className="toolbar-btn" 
                    title="Toggle Regional Pricing for All"
                  >
                    <Globe size={18} />
                  </button>
                </>
              )}
            </div>

            <div className="toolbar-divider" />

            <button onClick={() => setIsImportOpen(true)} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', gap: '0.4rem' }}>
              <FileText size={16} />
              <span>Import</span>
            </button>
            {isDecalMode && (
              <button onClick={() => document.getElementById('decal-files-input')?.click()} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', gap: '0.4rem' }}>
                <Upload size={16} />
                <span>Add Images</span>
              </button>
            )}
            <button onClick={addItem} className="btn btn-primary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', gap: '0.4rem' }}>
              <Plus size={16} />
              <span>{isDecalMode ? 'Add Decal' : 'Add Row'}</span>
            </button>
          </div>
        )}
      </div>

      {isDecalMode && (
        <div className="group-config-row">
          <label className="input-label">
            <KeyRound size={16} /> Group ID
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. 7654321"
            value={groupId}
            onChange={e => onGroupIdChange?.(e.target.value.replace(/[^\d]/g, ''))}
          />
        </div>
      )}

      {isProcessing ? (
        <div className="processing-state">
          <div className="spinner" />
          <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Processing {title}...</h4>
          <div className="progress-bar-container">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{progress}% Complete</p>
        </div>
      ) : results !== null ? (
        <div>
          <div className="results-grid">
            <div className="result-card success">
              <span style={{ color: 'var(--success-text)', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase' }}>Successfully Processed</span>
              <h4>{results.filter(r => r.success).length}</h4>
            </div>
            {results.filter(r => !r.success).length > 0 && (
              <div className="result-card error">
                <span style={{ color: 'var(--danger-text)', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase' }}>Failed</span>
                <h4>{results.filter(r => !r.success).length}</h4>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
             <button onClick={copyResults} className="btn btn-secondary" style={{ display: 'inline-flex', gap: '0.5rem', fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                <Copy size={14} /> Copy Report
             </button>
          </div>

          <table className="styled-table">
            <thead>
              <tr>
                <th>Name</th>
                {!isDecalMode && <th>Price</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr key={idx}>
                  <td>{r.item.name}</td>
                  {!isDecalMode && <td style={{ color: 'var(--text-muted)' }}>R$ {r.item.price}</td>}
                  <td>
                    {r.success ? (
                       <span className="status-badge ok">
                         <ShieldCheck size={14} /> ID: {r.data?.[type === 'DevProduct' ? 'productId' : type === 'GamePass' ? 'gamePassId' : 'assetId'] ?? 'Ok'}
                       </span>
                    ) : (
                       <span className="status-badge fail">
                         Error: {r.error}
                       </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button onClick={() => { setResults(null); }} className="btn btn-primary">
              Back to Editor
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="items-container">
            {items.map((item, index) => {
              if (!showExisting && item.isExisting && !item.isDirty) return null;
              return (
                <div key={index} className={`item-row ${item.isExisting ? 'existing' : ''} ${item.isDirty ? 'dirty' : ''}`}>
                  {item.isExisting && <span className="badge-existing">Existing</span>}
                
                <div className={`item-row-main ${isDecalMode ? 'decal-row-main' : ''}`}>
                  <input 
                    type="text" 
                    placeholder={isDecalMode ? "Decal Name" : "Asset Name"} 
                    className="input" 
                    style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                    value={item.name}
                    title={item.isExisting ? `ID: ${item.id}` : 'New Asset'}
                    onChange={e => updateItem(index, { name: e.target.value })}
                  />
                  
                  {!isDecalMode && (
                    <div className="price-input">
                      <span>R$</span>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="0" 
                        className="input" 
                        style={{ background: 'transparent', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                        value={item.price === 0 ? '' : item.price}
                        onChange={e => updateItem(index, { price: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="file" 
                      id={`file-${type}-${index}`} 
                      style={{ display: 'none' }}
                      accept={isDecalMode ? ".png,.jpg,.jpeg,.bmp,.tga" : ".png,.jpg,.jpeg"}
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          updateItem(index, { imageFile: e.target.files[0] });
                        }
                      }}
                    />
                    {item.iconUrl && !item.imageFile && (
                      <img src={item.iconUrl} alt="Icon" style={{ width: '30px', height: '30px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--border)' }} />
                    )}
                    <button 
                      onClick={() => handleUploadClick(index)}
                      className={`upload-btn ${item.imageFile ? 'has-file' : ''}`}
                      title={item.imageFile ? item.imageFile.name : 'Upload Icon'}
                    >
                      <Upload size={16} />
                      <span>{item.imageFile ? item.imageFile.name : (item.iconUrl ? 'Change' : 'Icon')}</span>
                    </button>
                  </div>
                  
                  {!isDecalMode && (
                    <div className="switch-wrapper" onClick={() => updateItem(index, { isRegionalPricingEnabled: !item.isRegionalPricingEnabled })}>
                      <span className="switch-label">Regional</span>
                      <div className="switch-track" data-on={item.isRegionalPricingEnabled ? 'true' : 'false'}>
                        <div className="switch-thumb" />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => removeItem(index)} 
                      disabled={items.length === 1}
                      className="btn btn-danger"
                      style={{ width: '40px', height: '40px', background: 'transparent', color: items.length === 1 ? 'var(--border)' : 'var(--danger-text)', border: 'none', cursor: items.length === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="item-row-details">
                  <input 
                    type="text" 
                    placeholder="Asset Description (optional)" 
                    className="input" 
                    style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                    value={item.description}
                    onChange={e => updateItem(index, { description: e.target.value })}
                  />
                </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <button onClick={addItem} className="btn btn-secondary">
              <Plus size={16} />
              <span>{isDecalMode ? 'Add Decal' : 'Add Row'}</span>
            </button>
            
            <button 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={pendingItemCount === 0 || (hasPendingNewDecals && !groupId.trim())}
            >
              <Upload size={16} />
              <span>{isDecalMode ? `Create / Update Decals (${pendingItemCount})` : `Bulk Create / Update (${pendingItemCount})`}</span>
            </button>
          </div>
        </div>
      )}

      {isImportOpen && (
        <div className="modal-overlay" onClick={() => setIsImportOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h4 className="modal-title">Bulk Import Assets</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Paste lines of text from Excel, Google Sheets, CSV, or an AI. Delimiters like <strong>Tab</strong>, <strong>Pipe (|)</strong>, or <strong>Comma (,)</strong> are automatically parsed.
            </p>
            
            <div style={{ position: 'relative' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                AI Formatting Instruction (Click to copy)
              </span>
              <div 
                className="ai-prompt-box" 
                onClick={async () => {
                  const prompt = isDecalMode ? `Please format these Roblox decals in the following pipe-delimited format:
Name | Description | ID

Example output:
Dragon Emblem | Red dragon clan wall decal | 12345678901234
Victory Stamp | Gold victory icon decal | 23456789012345` : `Please format these Roblox products/gamepasses in the following pipe-delimited format:
Name | Price | Description | ID

Example output:
50K Coins | 15 | Provides 50,000 in-game coins | 1234567890
Double Cash Pass | 199 | Permanent 2x cash multiplier | 2345678901`;
                  await navigator.clipboard.writeText(prompt);
                  alert("AI formatting instructions copied to clipboard!");
                }}
              >
                <button className="ai-prompt-copy-btn">Copy Instructions</button>
                {isDecalMode ? (
                  <>
                    Please format these Roblox decals in the following pipe-delimited format:{"\n"}
                    <strong>Name | Description | ID</strong>{"\n\n"}
                    Example:{"\n"}
                    Dragon Emblem | Red dragon clan wall decal | 12345678901234{"\n"}
                    Victory Stamp | Gold victory icon decal | 23456789012345
                  </>
                ) : (
                  <>
                    Please format these Roblox products/gamepasses in the following pipe-delimited format:{"\n"}
                    <strong>Name | Price | Description | ID</strong>{"\n\n"}
                    Example:{"\n"}
                    50K Coins | 15 | Provides 50,000 in-game coins | 1234567890{"\n"}
                    Double Cash Pass | 199 | Permanent 2x cash multiplier | 2345678901
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Paste Text Data Here:</span>
              <textarea 
                className="import-textarea"
                placeholder={isDecalMode ? `Name | Description | ID\ne.g.\nChocolate Dumpling |  | 92811737933400\nQuake Dumpling |  | 107993724593501` : `Name | Price | Description | ID\ne.g.\nLuck Spray | 89 | Grants 2x luck boost | 1234567890\nDouble Speed | 149 | Permanent speed increase | 2345678901`}
                value={importText}
                onChange={e => setImportText(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsImportOpen(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={async () => {
                  if (!importText.trim()) return;
                  const parsed = parseBulkText(importText, isDecalMode);
                  if (parsed.length > 0) {
                     const importedItems: BulkCreateItem[] = parsed.map(parsedItem => ({
                       name: parsedItem.name,
                       price: parsedItem.price,
                       description: parsedItem.description,
                       isRegionalPricingEnabled: false,
                       imageFile: null,
                       id: parsedItem.id,
                       isExisting: !!parsedItem.id,
                       isDirty: true,
                     }));
                     const hydratedItems = isDecalMode ? await hydrateDecalRows(importedItems) : importedItems;

                     setItems(prevItems => {
                        const updatedItems = [...prevItems];
                        
                        for (const parsedItem of hydratedItems) {
                           const matchIndex = updatedItems.findIndex(
                              item => (parsedItem.id && item.id === parsedItem.id) || item.name.trim().toLowerCase() === parsedItem.name.trim().toLowerCase()
                           );
                           
                           if (matchIndex !== -1) {
                              // Match found! Update price and description in-place, preserving isExisting and Roblox ID!
                              updatedItems[matchIndex] = {
                                 ...updatedItems[matchIndex],
                                 price: isDecalMode ? updatedItems[matchIndex].price : parsedItem.price,
                                 description: parsedItem.description,
                                 id: parsedItem.id || updatedItems[matchIndex].id,
                                 iconUrl: parsedItem.iconUrl || updatedItems[matchIndex].iconUrl,
                                 isExisting: updatedItems[matchIndex].isExisting || !!parsedItem.id,
                                 isDirty: true
                              };
                           } else {
                              // No match found! Append as new asset row
                              const emptyIndex = updatedItems.findIndex(
                                 item => item.name.trim() === '' && item.price === 0 && item.description === '' && !item.isExisting
                              );
                              if (emptyIndex !== -1) {
                                 updatedItems.splice(emptyIndex, 0, parsedItem);
                              } else {
                                 updatedItems.push(parsedItem);
                              }
                           }
                        }
                        
                        const hasEmpty = updatedItems.some(
                           item => item.name.trim() === '' && item.price === 0 && item.description === '' && !item.isExisting
                        );
                        if (!hasEmpty) {
                           updatedItems.push(emptyItem());
                        }
                        
                        return updatedItems;
                     });
                     
                     setImportText('');
                     setIsImportOpen(false);
                  } else {
                     alert("Could not parse any valid assets. Please check the formatting!");
                  }
                }}
              >
                Import {parseBulkText(importText, isDecalMode).length} Assets
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
