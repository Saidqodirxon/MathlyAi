import { useState, useEffect } from "react";
import {
  Cpu,
  Key,
  Plus,
  Pause,
  Play,
  Trash2,
  TrendingUp,
  CheckCircle,
  Zap,
} from "lucide-react";
import "./AIConfig.css";

// Model ma'lumotlari (narx va tezlik)
const MODEL_INFO = {
  "gpt-4o-mini": {
    price: "$",
    speed: "Juda tez",
    description: "Eng arzon va tez",
  },
};

export default function AIConfig({ aiProvidersAPI }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingToken, setEditingToken] = useState(null);
  const [testingProvider, setTestingProvider] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const data = await aiProvidersAPI.getAll();
      // Faqat ChatGPT providerni ko'rsatish
      // setProviders(data.providers);

      const filteredProviders = data.providers.filter(
        (provider) => provider.provider === "openai"
      );
      setProviders(filteredProviders);
    } catch (error) {
      console.error("Failed to load providers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateProvider = async (providerId) => {
    try {
      await aiProvidersAPI.activate(providerId);
      await loadProviders();
    } catch (error) {
      alert("Provider faollashtirib bo'lmadi");
    }
  };

  const handleUpdateModel = async (providerId, model) => {
    try {
      await aiProvidersAPI.updateModel(providerId, model);
      await loadProviders();
    } catch (error) {
      alert("Model yangilab bo'lmadi");
    }
  };

  const handleAddToken = async (providerId) => {
    const key = prompt("API Keyni kiriting:");
    if (!key) return;

    const label = prompt("Token nomini kiriting (ixtiyoriy):", "Token 1");
    const dailyLimit = parseInt(prompt("Kunlik limitni kiriting:", "1000"));

    try {
      await aiProvidersAPI.addToken(providerId, { key, label, dailyLimit });
      await loadProviders();
    } catch (error) {
      alert("Token qo'shib bo'lmadi");
    }
  };

  const handleUpdateToken = async (providerId, tokenId, updates) => {
    try {
      await aiProvidersAPI.updateToken(providerId, tokenId, updates);
      await loadProviders();
      setEditingToken(null);
    } catch (error) {
      alert("Token yangilab bo'lmadi");
    }
  };

  const handleDeleteToken = async (providerId, tokenId) => {
    if (!confirm("Bu tokenni o'chirmoqchimisiz?")) return;

    try {
      await aiProvidersAPI.deleteToken(providerId, tokenId);
      await loadProviders();
    } catch (error) {
      alert("Token o'chirib bo'lmadi");
    }
  };

  const handleTestProvider = async (providerId) => {
    setTestingProvider(providerId);
    setTestResult(null);

    try {
      const result = await aiProvidersAPI.testProvider(providerId);
      setTestResult({
        providerId,
        success: true,
        ...result,
      });
    } catch (error) {
      setTestResult({
        providerId,
        success: false,
        error: error.response?.data?.error || error.message,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  if (loading) {
    return <div className="loading">AI sozlamalari yuklanmoqda...</div>;
  }

  return (
    <div className="ai-config">
      <div className="config-header">
        <div className="header-icon">
          <Cpu size={24} />
        </div>
        <h2>AI Provider Sozlamalari</h2>
      </div>

      <div className="providers-list">
        {providers.map((provider) => (
          <div
            key={provider._id}
            className={`provider-card ${provider.isActive ? "active" : ""}`}
          >
            <div className="provider-header">
              <div>
                <h3>{provider.displayName}</h3>
                <span className="provider-type">{provider.provider}</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={provider.isActive}
                  onChange={() => handleActivateProvider(provider._id)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="provider-stats">
              <div className="stat">
                <TrendingUp size={16} />
                <div>
                  <span>Umumiy foydalanish</span>
                  <strong>{provider.totalUsage}</strong>
                </div>
              </div>
              <div className="stat">
                <Key size={16} />
                <div>
                  <span>Faol tokenlar</span>
                  <strong>
                    {provider.tokens.filter((t) => t.isActive).length} /{" "}
                    {provider.tokens.length}
                  </strong>
                </div>
              </div>
            </div>

            <div className="model-selector">
              <label>Model:</label>
              <select
                value={provider.selectedModel}
                onChange={(e) =>
                  handleUpdateModel(provider._id, e.target.value)
                }
              >
                {provider.availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}{" "}
                    {MODEL_INFO[model]
                      ? `- ${MODEL_INFO[model].price} - ${MODEL_INFO[model].speed}`
                      : ""}
                  </option>
                ))}
              </select>
              {MODEL_INFO[provider.selectedModel] && (
                <div className="model-details">
                  <span className="model-price">
                    {MODEL_INFO[provider.selectedModel].price}
                  </span>
                  <span className="model-speed">
                    ⚡ {MODEL_INFO[provider.selectedModel].speed}
                  </span>
                  <span className="model-desc">
                    {MODEL_INFO[provider.selectedModel].description}
                  </span>
                </div>
              )}
            </div>

            <div className="test-section">
              <button
                className="btn btn-test"
                onClick={() => handleTestProvider(provider._id)}
                disabled={
                  testingProvider === provider._id || !provider.isActive
                }
              >
                <Zap size={16} />
                <span>
                  {testingProvider === provider._id
                    ? "Tekshirilmoqda..."
                    : "Providerni tekshirish"}
                </span>
              </button>

              {testResult && testResult.providerId === provider._id && (
                <div
                  className={`test-result ${
                    testResult.success ? "success" : "error"
                  }`}
                >
                  <div className="test-result-header">
                    <strong>
                      {testResult.success ? "✅ Muvaffaqiyatli" : "❌ Xato"}
                    </strong>
                    {testResult.tokenLabel && (
                      <span className="token-used">
                        Token: {testResult.tokenLabel}
                      </span>
                    )}
                  </div>

                  {testResult.success ? (
                    <>
                      <div className="test-query">
                        <small>So'rov:</small>
                        <p>{testResult.testQuery}</p>
                      </div>
                      <div className="test-response">
                        <small>Javob:</small>
                        <p>{testResult.answer || testResult.response}</p>
                      </div>
                      <div className="test-timing">
                        <small>Javob vaqti: {testResult.responseTime}ms</small>
                      </div>
                    </>
                  ) : (
                    <div className="test-error">
                      <p>{testResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="tokens-section">
              <div className="section-header">
                <h4>API Tokenlar</h4>
                <button
                  className="btn btn-sm"
                  onClick={() => handleAddToken(provider._id)}
                >
                  <Plus size={16} />
                  <span>Token qo'shish</span>
                </button>
              </div>

              {provider.tokens.length === 0 ? (
                <p className="no-tokens">Tokenlar yo'q</p>
              ) : (
                <div className="tokens-list">
                  {provider.tokens.map((token) => (
                    <div key={token._id} className="token-item">
                      <div className="token-info">
                        <div className="token-label">
                          {token.label}
                          {!token.isActive && (
                            <span className="badge-inactive">Inactive</span>
                          )}
                        </div>
                        <div className="token-key">
                          {token.key.substring(0, 20)}...
                        </div>
                        <div className="token-usage">
                          <span>
                            Today: {token.usedToday} / {token.dailyLimit}
                          </span>
                          <span>Total: {token.usageCount}</span>
                        </div>
                      </div>
                      <div className="token-actions">
                        <button
                          className="btn-icon"
                          onClick={() =>
                            handleUpdateToken(provider._id, token._id, {
                              isActive: !token.isActive,
                            })
                          }
                          title={token.isActive ? "Deactivate" : "Activate"}
                        >
                          {token.isActive ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
                        <button
                          className="btn-icon delete"
                          onClick={() =>
                            handleDeleteToken(provider._id, token._id)
                          }
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
