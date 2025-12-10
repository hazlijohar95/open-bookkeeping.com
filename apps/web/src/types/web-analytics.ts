export type AnalyticsEventSuffix =
  | "-click"
  | "-action"
  | "-submit"
  | "-download"
  | "-toggle"
  | "-select"
  | "-open"
  | "-close";

export type AnalyticsEventGroup = "create-invoice-page" | "edit-invoice-page" | "landing-page";

export interface IAnalytics {
  name: `${string}${AnalyticsEventSuffix}`;
  group?: AnalyticsEventGroup;
}
