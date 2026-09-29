import type { Preview } from '@storybook/react-vite'
import '@fontsource-variable/dm-sans/wght.css'
import '@fontsource-variable/manrope/wght.css'
import '../src/styles.css'
import '../src/screens/Compare.css'

const preview: Preview = {
  initialGlobals: { theme: 'dark', palette: 'default' },
  globalTypes: {
    theme: {
      description: 'Appearance',
      toolbar: {
        title: 'Appearance',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
      },
    },
    palette: {
      description: 'Colour palette',
      toolbar: {
        title: 'Palette',
        items: [
          { value: 'default', title: 'Pockit Iris' },
          { value: 'garden', title: 'Garden' },
          { value: 'waypoint', title: 'Coral' },
          { value: 'ocean', title: 'Ocean' },
          { value: 'plum', title: 'Plum' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      document.documentElement.dataset.theme = String(context.globals.theme || 'dark')
      document.documentElement.dataset.palette = String(context.globals.palette || 'default')
      return (
        <main style={{ minHeight: '100vh', padding: 24, background: 'var(--bg)' }}>
          <div style={{ width: 'min(100%, 402px)', margin: '0 auto' }}>
            <Story />
          </div>
        </main>
      )
    },
  ],
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        iphone: { name: 'iPhone', styles: { width: '402px', height: '874px' } },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '800px' } },
      },
    },
  },
}

export default preview
