import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Layout from "./components/Layout/Layout";
import Dashboard from "./pages/Dashboard";
import Instances from "./pages/Instances";
import Contacts from "./pages/Contacts";
import Groups from "./pages/Groups";
import Send from "./pages/Send";
import Login from "./pages/Login";
import UsersPage from "./pages/UsersPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* rota pública */}
            <Route path="/login" element={<Login />} />

            {/* rotas protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="instances" element={<Instances />} />
                <Route path="contacts" element={<Contacts />} />
                <Route path="groups" element={<Groups />} />
                <Route path="send" element={<Send />} />
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
