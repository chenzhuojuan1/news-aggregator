export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// No longer using OAuth - login is handled by password form
export const getLoginUrl = () => {
  return "/login";
};
