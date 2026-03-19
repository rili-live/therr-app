import React from 'react';
import { Text } from 'react-native';
import Autolink from 'react-native-autolink';

const mentionRegex = /(^|[\s(])@([a-zA-Z0-9_]+)/g;

interface IRichTextProps {
    text: string;
    linkStyle?: any;
    style?: any;
    onMentionPress?: (username: string) => void;
    numberOfLines?: number;
    selectable?: boolean;
}

const parseMentions = (text: string) => {
    const parts: { type: 'text' | 'mention'; value: string }[] = [];
    let lastIndex = 0;
    const matches = text.matchAll(mentionRegex);

    for (const match of matches) {
        const fullMatch = match[0];
        const prefix = match[1]; // whitespace or paren before @
        const username = match[2];
        const matchStart = match.index!;

        if (matchStart + prefix.length > lastIndex) {
            parts.push({ type: 'text', value: text.slice(lastIndex, matchStart + prefix.length) });
        }

        parts.push({ type: 'mention', value: username });
        lastIndex = matchStart + fullMatch.length;
    }

    if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return parts;
};

const RichText: React.FC<IRichTextProps> = ({
    text,
    linkStyle,
    style,
    onMentionPress,
    numberOfLines,
    selectable,
}) => {
    if (!text) {
        return null;
    }

    const parts = parseMentions(text);

    const hasMentions = parts.some((p) => p.type === 'mention');

    if (!hasMentions) {
        return (
            <Autolink
                style={style}
                text={text}
                linkStyle={linkStyle}
                phone="sms"
                numberOfLines={numberOfLines}
                selectable={selectable}
            />
        );
    }

    return (
        <Text style={style} numberOfLines={numberOfLines} selectable={selectable}>
            {parts.map((part, index) => {
                if (part.type === 'mention') {
                    return (
                        <Text
                            key={index}
                            style={linkStyle}
                            onPress={onMentionPress ? () => onMentionPress(part.value) : undefined}
                        >
                            @{part.value}
                        </Text>
                    );
                }

                return (
                    <Autolink
                        key={index}
                        text={part.value}
                        linkStyle={linkStyle}
                        phone="sms"
                    />
                );
            })}
        </Text>
    );
};

export default RichText;
