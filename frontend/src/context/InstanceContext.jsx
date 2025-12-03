import { createContext, useContext, useEffect, useState } from "react";

const InstanceContext = createContext(null);

export function InstanceProvider({ children }) {
  const [activeInstance, setActiveInstance] = useState(null);

  // carregar instância ativa do localStorage ao abrir o app
  useEffect(() => {
    const stored = localStorage.getItem("active_instance");
    if (stored) {
      try {
        setActiveInstance(JSON.parse(stored));
      } catch {
        localStorage.removeItem("active_instance");
      }
    }
  }, []);

  function selectInstance(instance) {
    setActiveInstance(instance);
    if (instance) {
      localStorage.setItem("active_instance", JSON.stringify(instance));
    } else {
      localStorage.removeItem("active_instance");
    }
  }

  return (
    <InstanceContext.Provider value={{ activeInstance, selectInstance }}>
      {children}
    </InstanceContext.Provider>
  );
}

export function useInstance() {
  return useContext(InstanceContext);
}
