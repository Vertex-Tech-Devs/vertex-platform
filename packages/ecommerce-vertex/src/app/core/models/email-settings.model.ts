export interface EmailTemplate {
  subject: string;
  template: string;
  showManageButton?: boolean;
  showWhatsappButton?: boolean;
}

export interface EmailSettings {
  id?: string;
  storeOwnerEmail: string;
  storeWhatsappNumber: string;
  adminNotification: EmailTemplate;
  customerConfirmation: EmailTemplate;
}
