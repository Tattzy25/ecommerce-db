import { Generated } from "kysely";

export interface Database {
  users: UserTable;
  credit_ledger: CreditLedgerTable;
}

export interface UserTable {
  id: string; // Stored as UUID string
  email: string;
  credit_balance: Generated<number>; // Generated means DB provides default
  last_monthly_grant: Generated<number>; // Unix timestamp
}

export interface CreditLedgerTable {
  id: string;
  user_id: string;
  amount: number;
  action_type: string;
  reference_id: string | null;
  created_at: Generated<number>;
}
