// Domínios de produção usados pra separar as duas áreas do app (dashboard geral
// da agência vs. dashboards individuais de cliente). Centralizado aqui porque
// tanto o middleware quanto os crons precisam saber "em qual domínio estou rodando".
export const DIGITAL_ESQUINA_HOST = 'digital-esquina.vercel.app'
export const PULSE_HOST = 'pulse-esquina.vercel.app'
export const LOCAL_HOSTS = ['localhost:3000', '127.0.0.1:3000']

export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.includes(host)
}
