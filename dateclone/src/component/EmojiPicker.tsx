import { useState, useRef, useEffect, useCallback } from "react";

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    show?: boolean;
    onClose?: () => void;
}

const EMOJI_CATEGORIES = [
    {
        name: "Smileys",
        emojis: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "💀", "☠️", "💩", "🤡", "👻", "💫", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"],
    },
    {
        name: "Gestures",
        emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄"],
    },
    {
        name: "Hearts",
        emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "🫶", "💑", "💏", "👩‍❤️‍👩", "👨‍❤️‍👨", "👩‍❤️‍👨"],
    },
    {
        name: "Reactions",
        emojis: ["🔥", "💯", "✨", "⭐", "🌟", "💫", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "👑", "💎", "🌸", "🌹", "🌺", "🌻", "🌷", "🌿", "☀️", "🌈", "⚡", "🌊", "🍀", "🎵", "🎶", "💃", "🕺", "🎯", "🚀", "💡"],
    },
];

const EmojiPicker = ({ onSelect, show = false, onClose }: EmojiPickerProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const [activeCategory, setActiveCategory] = useState(0);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose?.();
            }
        };
        if (show) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [show, onClose]);

    if (!show) return null;

    return (
        <div className="emoji-picker" ref={ref} role="dialog" aria-label="Emoji picker">
            <div className="emoji-categories" role="tablist">
                {EMOJI_CATEGORIES.map((cat, i) => (
                    <button
                        key={cat.name}
                        className={`emoji-cat-btn ${i === activeCategory ? "active" : ""}`}
                        onClick={() => setActiveCategory(i)}
                        role="tab"
                        aria-selected={i === activeCategory}
                        aria-label={cat.name}
                    >
                        {cat.emojis[0]}
                    </button>
                ))}
            </div>
            <div className="emoji-grid" role="tabpanel">
                {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
                    <button
                        key={emoji}
                        className="emoji-btn"
                        onClick={() => onSelect(emoji)}
                        aria-label={emoji}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default EmojiPicker;