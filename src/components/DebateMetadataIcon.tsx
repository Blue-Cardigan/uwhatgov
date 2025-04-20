import React from 'react';
import { getPartySvgFill } from '@/lib/partyColors';
import { DebateMetadata } from '@/types'; // Assuming DebateMetadata is in types.ts

interface DebateMetadataIconProps {
  metadata: DebateMetadata | null | undefined;
  size?: number; // Diameter of the icon
}

const DebateMetadataIcon: React.FC<DebateMetadataIconProps> = ({ metadata, size = 40 }) => {
  const radius = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Simple spinner for loading state
  if (metadata?.isLoading) {
    return (
      <div style={{ width: size, height: size }} className="flex-shrink-0 rounded-full border-2 border-gray-600 border-t-teal-500 animate-spin"></div>
    );
  }

  // Error indicator
  if (metadata?.error) {
     return (
       <div style={{ width: size, height: size }} title={metadata.error} className="flex-shrink-0 rounded-full bg-red-800 flex items-center justify-center text-white text-xs">!</div>
     );
  }

  // Placeholder if no metadata yet
  if (!metadata || !metadata.partyRatios || typeof metadata.speakerCount !== 'number') {
    return <div style={{ width: size, height: size }} className="flex-shrink-0 w-10 h-10 bg-gray-600 rounded-full"></div>;
  }

  const { partyRatios, speakerCount } = metadata;
  const ratios = Object.entries(partyRatios)
    .filter(([party, ratio]) => ratio > 0) // Filter out zero ratios
    .sort(([, ratioA], [, ratioB]) => ratioB - ratioA); // Optional: Sort by ratio desc

  let cumulativeAngle = -90; // Start at 12 o'clock

  const paths = ratios.map(([party, ratio]) => {
    const angle = ratio * 360;
    const startAngleRad = (cumulativeAngle * Math.PI) / 180;
    const endAngleRad = ((cumulativeAngle + angle) * Math.PI) / 180;

    const startX = radius + radius * Math.cos(startAngleRad);
    const startY = radius + radius * Math.sin(startAngleRad);
    const endX = radius + radius * Math.cos(endAngleRad);
    const endY = radius + radius * Math.sin(endAngleRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${radius},${radius}`, // Move to center
      `L ${startX},${startY}`, // Line to start of arc
      `A ${radius},${radius} 0 ${largeArcFlag},1 ${endX},${endY}`, // Arc to end point
      'Z', // Close path (back to center)
    ].join(' ');

    cumulativeAngle += angle;

    return (
      <path
        key={party}
        d={pathData}
        fill={getPartySvgFill(party)}
      />
    );
  });

  // Handle case where there are ratios but they sum to 0 (shouldn't happen with filter)
    // or if ratios array is empty after filtering
  if (paths.length === 0 && speakerCount >= 0) {
     // Draw a default background circle if no parties have ratios > 0
     paths.push(<circle key="default-bg" cx={radius} cy={radius} r={radius} fill={getPartySvgFill(null)} />);
  }


  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0 rounded-full">
      {/* Render pie slices */}
      {paths}
      {/* Render speaker count in the center */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".3em" // Adjust vertical alignment
        fontSize={radius * 0.6} // Adjust font size relative to radius
        fill="#FFFFFF" // White text
        fontWeight="bold"
      >
        {speakerCount}
      </text>
    </svg>
  );
};

export default DebateMetadataIcon; 