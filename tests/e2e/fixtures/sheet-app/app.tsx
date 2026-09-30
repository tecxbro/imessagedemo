// Only serves artifacts compiled by the real CLI in the e2e setup; no client-side permission bypass.
import { createRoot } from 'react-dom/client';
import { DemoPlayer } from '@/player/DemoPlayer';
import '@/styles.css';
const { compiled } = await (await fetch('/__sheet-test.json')).json();
createRoot(document.getElementById('root')!).render(<DemoPlayer compiled={compiled} clean initialTimeMs={3000} playbackBaseline={0} scenarioId={compiled.id}/>);
