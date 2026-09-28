'use client';

/** The company's WhatsApp details (Admin → Company) for client components: the root layout reads
 *  them on the server (lib/company.ts) and provides them here, so a WhatsApp button in a client
 *  component opens the saved number. Only these two fields reach the browser's page data: a
 *  hidden email or a switched-off link must not ship. Server components call getCompany(). */

import { createContext, useContext } from 'react';
import { COMPANY_DEFAULTS, type Company } from '@/lib/site';

export type ClientCompany = Pick<Company, 'whatsapp' | 'whatsappText'>;

const CompanyContext = createContext<ClientCompany>(COMPANY_DEFAULTS);

export function CompanyProvider({ value, children }: { value: ClientCompany; children: React.ReactNode }) {
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export const useCompany = () => useContext(CompanyContext);
