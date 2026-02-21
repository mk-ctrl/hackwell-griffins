import React, { useEffect, useState } from 'react';
// import { motion } from 'framer-motion';
// import { RadialBarChart, RadialBar, Legend } from 'recharts';

// const SidePanel = () => {
//   const [thoughts, setThoughts] = useState<string[]>([]);
//   const [riskScore, setRiskScore] = useState(0.5);

//   useEffect(() => {
//     chrome.runtime.onMessage.addListener((msg) => {
//       if (msg.type === 'analyze') {
//         const ws = new WebSocket('ws://localhost:8000/ws');
//         ws.onopen = () => ws.send(msg.text);
//         ws.onmessage = (event) => {
//           setThoughts((prev) => [...prev, event.data]);
//           const scoreMatch = event.data.match(/Risk Score: (\d\.\d+)/);
//           if (scoreMatch) setRiskScore(parseFloat(scoreMatch[1]));
//         };
//       }
//     });
//   }, []);

//   const data = [{ name: 'Risk', value: riskScore * 100, fill: '#ff7300' }];

//   return (
//     <div style={{ padding: '16px' }}>
//       <h1>MindArmor XAI</h1>
//       <RadialBarChart 
//             width={200} 
//             height={200} 
//             cx="50%" 
//             cy="50%" 
//             innerRadius="40%" 
//             outerRadius="80%" 
//             startAngle={90}    // Start at top
//             endAngle={-270}    // Sweep clockwise to bottom-right
//             data={data}
//             >
//             <RadialBar 
//                 dataKey="value" 
//                 fill="#ff7300" 
//                 cornerRadius={10}  // Rounded ends if desired
//             />
//             {/* Optional: Add a background ring */}
//             <RadialBar dataKey="value" fill="#eee" opacity={0.3} />
//         </RadialBarChart>
//       <motion.ul animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
//         {thoughts.map((thought, i) => <li key={i}>{thought}</li>)}
//       </motion.ul>
//     </div>
//   );
// };

// export default SidePanel;

const SidePanel = () => {
  const [analyses, setAnalyses] = useState<any[]>([]);

  useEffect(() => {
    const listener = (msg: any) => {
      if (msg.type === 'analyze') {
        // Placeholder - later call backend via WebSocket
        const neutral = `Neutral version: ${msg.text.replace(/urgent|crisis/g, 'reported').replace(/disgusting/g, 'concerning')}`;

        setAnalyses(prev => [...prev, {
          original: msg.text,
          risk: 0.75,
          type: 'emotional framing',
          explanation: 'Uses fear words like "crisis" to trigger System 1 response.',
          neutral,
        }]);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui' }}>
      <h1>MindArmor XAI</h1>
      <p>Monitoring current page for manipulation...</p>

      {analyses.length === 0 && <p>No manipulative content detected yet.</p>}

      {analyses.map((a, i) => (
        <div key={i} style={{ margin: '12px 0', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <strong>Original:</strong> {a.original}<br />
          <strong>Risk:</strong> {Math.round(a.risk * 100)}% ({a.type})<br />
          <strong>Why:</strong> {a.explanation}<br />
          <strong>Neutral tone:</strong> {a.neutral}
        </div>
      ))}
    </div>
  );
};
export default SidePanel;