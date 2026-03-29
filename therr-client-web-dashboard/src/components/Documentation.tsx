import React from 'react';

interface IDocumentationProps {
    title?: string;
    description?: React.ReactNode;
    scope?: Record<string, unknown>;
    imports?: string;
    example?: string;
}

const Documentation: React.FC<IDocumentationProps> = ({
    title,
    description,
    example,
}) => (
    <div className="documentation-section mb-4">
        {title && <h3>{title}</h3>}
        {description && <div className="description">{description}</div>}
        {example && (
            <pre className="bg-light p-3 rounded">
                <code>{example}</code>
            </pre>
        )}
    </div>
);

export default Documentation;
