import { genericAdapter, type AtsAdapter } from "./base";
import { ashbyAdapter } from "./ashby";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { smartRecruitersAdapter } from "./smartrecruiters";
import { workdayAdapter } from "./workday";

const ADAPTERS: AtsAdapter[] = [greenhouseAdapter, leverAdapter, ashbyAdapter, smartRecruitersAdapter, workdayAdapter];

export function adapterForHostname(hostname: string): AtsAdapter {
  return ADAPTERS.find((adapter) => adapter.matches(hostname)) ?? genericAdapter;
}

export function registerAdapter(adapter: AtsAdapter): void {
  ADAPTERS.unshift(adapter);
}
