import axios from "axios";

const API_URL =
  process.env.REACT_APP_API_URL || "https://msg.adfamilia.org/api";


const api = axios.create({
  baseURL: API_URL,
});

// Interceptor → sempre injeta o token correto
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export { api };
