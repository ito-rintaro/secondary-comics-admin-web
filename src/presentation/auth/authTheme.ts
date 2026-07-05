import type { Theme } from '@aws-amplify/ui-react';
import { translations } from '@aws-amplify/ui-react';
import { I18n } from 'aws-amplify/utils';

/**
 * Amplify Authenticator をアプリのダークテーマ（index.css の CSS 変数）に合わせる。
 * Amplify UI は --amplify-* というデザイントークンで描画されるので、それを上書きする。
 */
export const authTheme: Theme = {
  name: 'secondary-comics-dark',
  tokens: {
    colors: {
      background: {
        primary: { value: '#181b22' }, // --panel
        secondary: { value: '#1f232c' }, // --panel2
      },
      font: {
        primary: { value: '#e7e9ee' }, // --text
        secondary: { value: '#9aa3b2' }, // --muted
      },
      border: {
        primary: { value: '#2a2f3a' }, // --line
      },
      brand: {
        primary: {
          10: { value: '#2a1420' },
          80: { value: '#e0245e' }, // --accent
          90: { value: '#c81e52' },
          100: { value: '#b01a48' },
        },
      },
    },
    components: {
      authenticator: {
        router: {
          backgroundColor: { value: '#181b22' },
          borderColor: { value: '#2a2f3a' },
        },
      },
      fieldcontrol: {
        color: { value: '#e7e9ee' },
        borderColor: { value: '#2a2f3a' },
      },
      tabs: {
        item: {
          color: { value: '#9aa3b2' },
          _active: { color: { value: '#e0245e' } },
        },
      },
    },
  },
};

/** Authenticator の表示を日本語化する（アプリ全体で 1 回実行すれば良い）。 */
export function configureAuthLanguage(): void {
  I18n.putVocabularies(translations);
  I18n.setLanguage('ja');
}
