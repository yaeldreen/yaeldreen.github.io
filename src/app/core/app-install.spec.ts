import { installHelp } from './app-install';

const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

describe('installHelp', () => {
  it('guide vers Safari sur iPhone', () => {
    expect(installHelp('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toContain('Sur l’écran d’accueil');
  });

  it('reconnaît un iPad, qui se présente comme un Mac', () => {
    expect(installHelp(MAC_SAFARI, true)).toContain('Sur l’écran d’accueil');
  });

  it('guide vers le Dock dans Safari sur Mac', () => {
    expect(installHelp(MAC_SAFARI)).toContain('Ajouter au Dock');
  });

  it('renvoie vers Chrome ou Edge depuis Firefox sur ordinateur', () => {
    expect(installHelp('Mozilla/5.0 (Windows NT 10.0; rv:130.0) Gecko/20100101 Firefox/130.0')).toContain('Chrome ou Edge');
    expect(installHelp('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0')).toContain('Chrome ou Edge');
  });

  it('guide vers le menu de Chrome sur ordinateur', () => {
    expect(installHelp('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toContain('Installer l’application');
  });

  it('guide vers le menu du navigateur ailleurs', () => {
    expect(installHelp('Mozilla/5.0 (Linux; Android 15)')).toContain('Installer l’application');
  });
});
