import { FileText, Search, Tag, Settings, Lock, Trash2, Clock, HardDrive } from 'lucide-react';
import { useStore, ViewType } from '../store';
import { useI18n } from '../i18n';
import * as App from '../../wailsjs/go/main/App';

interface NavItem {
  id: ViewType;
  icon: React.ReactNode;
  label: string;
}

export function Sidebar() {
  const {
    currentView,
    setCurrentView,
    setUnlocked,
    version,
    setSelectedTagId,
    setSelectedNotebookId,
  } = useStore();

  const { t } = useI18n();

  const navItems: NavItem[] = [
    { id: 'notes', icon: <FileText className="w-6 h-6" />, label: t.sidebar.notes },
    { id: 'recent', icon: <Clock className="w-6 h-6" />, label: t.sidebar.recent },
    { id: 'search', icon: <Search className="w-6 h-6" />, label: t.sidebar.search },
    { id: 'tags', icon: <Tag className="w-6 h-6" />, label: t.sidebar.tags },
    { id: 'backup', icon: <HardDrive className="w-6 h-6" />, label: t.sidebar.backup },
    { id: 'trash', icon: <Trash2 className="w-6 h-6" />, label: t.sidebar.trash },
    { id: 'settings', icon: <Settings className="w-6 h-6" />, label: t.sidebar.settings },
  ];

  const handleLock = async () => {
    await App.Lock();
    setUnlocked(false);
  };

  const handleNavClick = (id: ViewType) => {
    if (id === 'notes' || id === 'recent') {
      setSelectedTagId(null);
      setSelectedNotebookId(null);
    }
    setCurrentView(id);
  };


  return (
    <aside className="w-20 bg-white border-r border-primary-100 flex flex-col">
      <div className="flex-1 py-4 overflow-y-auto">
        <nav className="space-y-2 px-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex flex-col items-center justify-center py-3 rounded-xl transition-all ${
                currentView === item.id
                  ? 'bg-primary-100 text-accent'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
              title={item.label}
            >
              {item.icon}
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          ))}

        </nav>
      </div>

      <div className="p-3 border-t border-primary-100">
        <button
          onClick={handleLock}
          className="w-full flex flex-col items-center justify-center py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all"
          title={t.sidebar.lock}
        >
          <Lock className="w-6 h-6" />
          <span className="text-xs mt-1">{t.sidebar.lock}</span>
        </button>

        <div className="mt-4 text-center">
          <div className="text-xs text-gray-400">{t.settings.modePrivate}</div>
          <div className="text-xs text-gray-400 mt-1">{version}</div>
        </div>
      </div>
    </aside>
  );
}
