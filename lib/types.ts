export type Role = "admin" | "empleado";
export type ServiceType = "Sitio Web" | "Aplicación Web" | "Software Personalizado/Automatización";
export type DeliveryStatus =
  | "Cotizado"
  | "En desarrollo"
  | "En revisión"
  | "Entregado"
  | "En mantenimiento"
  | "Pausado/Cancelado";
export type PaymentStatus =
  | "Pendiente"
  | "Pago inicial recibido"
  | "Pagado parcial"
  | "Pagado completo"
  | "Mantenimiento al día"
  | "Mantenimiento atrasado";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  photoURL?: string;
  active: boolean;
  createdAt?: unknown;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  serviceType: ServiceType;
  deliveryStatus: DeliveryStatus;
  paymentStatus: PaymentStatus;
  currency: "MXN" | "USD";
  amount: number;
  initialPayment: number;
  monthlyMaintenance: number;
  startDate: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  nextMaintenanceDate?: string;
  responsibleIds: string[];
  notes: string;
  repoUrl?: string;
  productionUrl?: string;
  proposalUrl?: string;
  updatedAt?: unknown;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  text: string;
  createdAt?: {
  toDate?: () => Date;
} | Date;
}
