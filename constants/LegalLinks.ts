// El dominio rooalarm.app no resuelve (fallo de DNS, no 404): los enlaces que
// apuntaban ahí estaban rotos dentro de la app. Apple revisa los enlaces y los
// rotos son motivo de rechazo, así que todo va al dominio que sí sirve.
const SITE = 'https://roo-alarmweb.vercel.app';

export const LEGAL_LINKS = {
  home: `${SITE}/home`,
  terms: `${SITE}/terms`,
  privacy: `${SITE}/privacy`,
  support: `${SITE}/support`,
  supportEmail: 'rooalarm@gmail.com',
};
