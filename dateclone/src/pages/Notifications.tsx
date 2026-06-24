import AppNavbar from "../component/AppNavbar";
import "../style/notifications.css";

// Static demo notifications (real ones would come from a notifications API)
const DEMO_NOTIFICATIONS = [
    { id: "1", type: "match", icon: "💞", text: "You matched with Amara!", time: "2 mins ago" },
    { id: "2", type: "like", icon: "❤️", text: "Someone liked your profile!", time: "15 mins ago" },
    { id: "3", type: "msg", icon: "💬", text: "Kwame sent you a message.", time: "1 hour ago" },
    { id: "4", type: "visit", icon: "👀", text: "3 people viewed your profile today.", time: "3 hours ago" },
    { id: "5", type: "match", icon: "💞", text: "You matched with Zola!", time: "Yesterday" },
    { id: "6", type: "like", icon: "❤️", text: "Someone liked your profile!", time: "Yesterday" },
];

const Notifications = () => {
    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="notifications-page">
                <div className="notifications-header">
                    <h1>Notifications</h1>
                    <button className="notif-clear-btn">Mark all read</button>
                </div>

                <div className="notifications-list">
                    {DEMO_NOTIFICATIONS.map((n, i) => (
                        <div key={n.id} className={`notif-item ${i < 3 ? "unread" : ""}`}>
                            <div className="notif-icon">{n.icon}</div>
                            <div className="notif-content">
                                <p>{n.text}</p>
                                <span className="notif-time">{n.time}</span>
                            </div>
                            {i < 3 && <div className="notif-dot" />}
                        </div>
                    ))}
                </div>

                <div className="notif-info-box">
                    <p>🔔 Real-time push notifications require a backend WebSocket or push service integration. The items above are demo notifications.</p>
                </div>
            </div>
        </div>
    );
};

export default Notifications;
