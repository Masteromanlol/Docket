import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    serverTimestamp,
    orderBy,
    getDoc,
    setDoc
} from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID,
        measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
    };

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Main Application Component ---
function App() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [appView, setAppView] = useState('dashboard');
    const [activeChatId, setActiveChatId] = useState(null);
    const [items, setItems] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [currentView, setCurrentView] = useState(localStorage.getItem('docket-view-preference') || 'list');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);
                const profileRef = doc(db, 'users', user.uid);
                const unsubProfile = onSnapshot(profileRef, (profileSnap) => {
                    if (profileSnap.exists()) {
                        setUserProfile(profileSnap.data());
                    } else {
                        setUserProfile(false); // Sentinel value for profile creation
                    }
                    setLoading(false);
                });
                return () => unsubProfile();
            } else {
                setUser(null);
                setUserProfile(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if (!user) {
            setItems([]);
            return;
        };
        const itemsCollection = collection(db, 'items');
        const q = query(itemsCollection, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [user]);

    const handleProfileCreate = async (profileData) => {
        if (!user) return;
        const profileRef = doc(db, 'users', user.uid);
        await setDoc(profileRef, {
            ...profileData,
            email: user.email,
            createdAt: serverTimestamp()
        }, { merge: true });
    };

    const handleSaveItem = async (itemData) => {
        if (!user || !userProfile) return;
        const { id, ...data } = itemData;
        
        if (id) {
            await updateDoc(doc(db, 'items', id), data);
        } else {
            await addDoc(collection(db, 'items'), {
                ...data,
                userId: user.uid,
                ownerUsername: userProfile.username,
                createdAt: serverTimestamp()
            });
        }
        closeModal();
    };

    const confirmDeleteItem = async () => {
        if (!itemToDelete) return;
        await deleteDoc(doc(db, 'items', itemToDelete.id));
        setItemToDelete(null);
        closeModal();
    };

    const handleSignOut = async () => {
        await signOut(auth);
        setAppView('dashboard');
    };
    
    const openModal = (item = null) => {
        setCurrentItem(item);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentItem(null);
    };

    if (loading) {
        return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Loading Docket...</p></div>;
    }
    if (!user) {
        return <AuthComponent setAuthError={() => {}} />;
    }
    if (userProfile === false) {
        return <CreateProfilePage onCreateProfile={handleProfileCreate} />;
    }

    return (
        <div id="app" className="max-w-5xl mx-auto min-h-screen bg-white shadow-xl">
             <header className="bg-white/80 backdrop-blur-lg sticky top-0 z-20 p-4 border-b border-slate-200">
                <div className="flex justify-between items-center">
                     <div className="flex items-center space-x-3">
                        <div className="bg-indigo-600 p-2.5 rounded-xl"><svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg></div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight cursor-pointer" onClick={() => { setAppView('dashboard'); setActiveChatId(null); }}>Docket V3</h1>
                     </div>
                     <div className="flex items-center space-x-2">
                         <button onClick={() => { setAppView('messages'); setActiveChatId(null); }} className="p-2.5 rounded-full hover:bg-slate-100"><svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.72.148c-.984.038-1.92.383-2.705.945-1.326 1.002-3.69 1.002-5.016 0-.784-.562-1.72-.907-2.705-.945l-3.72-.148A2.093 2.093 0 013 14.893V10.607c0-.97.616-1.813 1.5-2.097L6.6 8.243c.92.275 1.902.275 2.822 0l.21-.062a2.109 2.109 0 011.836 0l.21.062c.92.275 1.902.275 2.822 0l2.1-.629zM15.75 7.5V6a2.25 2.25 0 00-2.25-2.25H10.5A2.25 2.25 0 008.25 6v1.5m6-1.5v2.25" /></svg></button>
                        <button onClick={handleSignOut} className="p-2.5 rounded-full hover:bg-slate-100"><svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg></button>
                     </div>
                </div>
            </header>

            {appView === 'dashboard' && <DashboardPage items={items} onOpenModal={openModal} currentView={currentView} setCurrentView={setCurrentView} />}
            {appView === 'messages' && <MessagesPage user={user} activeChatId={activeChatId} setActiveChatId={setActiveChatId} />}

            {appView === 'dashboard' && <button onClick={() => openModal()} className="fab"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>}
            
            {isModalOpen && <ItemModal item={currentItem} onSave={handleSaveItem} onClose={closeModal} onDelete={(item) => setItemToDelete(item)} user={user} />}
            {itemToDelete && <DeleteConfirmationModal item={itemToDelete} onConfirm={confirmDeleteItem} onCancel={() => setItemToDelete(null)} />}
        </div>
    );
}

const DashboardPage = ({ items, onOpenModal, currentView, setCurrentView }) => (
     <main className="p-4 md:p-6 pb-28">
         <div className="flex justify-end mb-4">
             <div className="flex space-x-1 p-1 bg-slate-200 rounded-full">
                <button onClick={() => { setCurrentView('list'); localStorage.setItem('docket-view-preference', 'list'); }} className={`p-2 rounded-full transition-colors ${currentView === 'list' ? 'view-btn-active' : ''}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg></button>
                <button onClick={() => { setCurrentView('grid'); localStorage.setItem('docket-view-preference', 'grid'); }} className={`p-2 rounded-full transition-colors ${currentView === 'grid' ? 'view-btn-active' : ''}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg></button>
             </div>
         </div>
        <div id="item-list" className={currentView === 'grid' ? 'grid-view' : ''}>
            {items.length > 0 ? items.map(item => <ItemCard key={item.id} item={item} view={currentView} onEdit={() => onOpenModal(item)} />) : (
                <div className="text-center p-8 mt-10 col-span-full">
                    <img src="https://assets.website-files.com/620141da15403f7342016a24/62187063d352ce71933f4862_icon-11-illustration-developer-services-brix-templates.svg" alt="Empty docket" className="w-48 h-48 mx-auto mb-4 opacity-70"/>
                    <h3 className="mt-2 text-xl font-bold text-slate-900">Your Docket is Empty</h3>
                    <p className="mt-1 text-md text-slate-500">Tap the '+' button to add your first item.</p>
                </div>
            )}
        </div>
    </main>
);

const ItemCard = ({ item, view, onEdit }) => {
    const priceFormatted = item.price && parseFloat(item.price) > 0 ? parseFloat(item.price).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : null;
    const photoUrl = 'https://placehold.co/600x400/f1f5f9/cbd5e1?text=No+Image'; // Placeholder for V3

    if (view === 'grid') {
        return (
            <div onClick={onEdit} className="item-card grid-card bg-white rounded-2xl flex flex-col transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer border border-slate-200">
                <div className="relative">
                    <img src={photoUrl} alt={item.name} className="item-photo" />
                    {item.isListed && priceFormatted && <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">{priceFormatted}</div>}
                </div>
                <div className="item-content w-full p-4">
                    <p className="font-bold text-slate-900 truncate">{item.name}</p>
                    <p className="text-sm text-slate-500 truncate">{item.category || 'No Category'}</p>
                </div>
            </div>
        );
    }
    return (
         <div onClick={onEdit} className="item-card bg-white p-4 rounded-2xl flex items-center space-x-4 mb-3 transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer border border-slate-200">
             <img src={photoUrl} alt={item.name} className="w-16 h-16 bg-slate-100 rounded-xl flex-shrink-0 object-cover" />
            <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{item.name}</p>
                <p className="text-sm text-slate-500 truncate">{item.category || 'No Category'} • {item.location || 'No Location'}</p>
            </div>
            {item.isListed && priceFormatted && <div className="text-right"><p className="font-bold text-green-600">{priceFormatted}</p></div>}
        </div>
    );
};

const CreateProfilePage = ({ onCreateProfile }) => {
    const [username, setUsername] = useState('');
    const [location, setLocation] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username.trim() || !location.trim()) return setError('Please fill out all fields.');
        if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) return setError('Username must be 3+ characters and contain only letters, numbers, or underscores.');
        setError('');
        onCreateProfile({ username, location, profilePictureURL: '' });
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Create Your Public Profile</h2>
                <p className="text-slate-600 mb-6">This information will be visible to other users in the marketplace.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="username" className="modal-label">Username</label>
                        <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} className="modal-input" placeholder="e.g., ArtCollector21" />
                    </div>
                    <div>
                        <label htmlFor="location" className="modal-label">City, State</label>
                        <input id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} className="modal-input" placeholder="e.g., Boulder, CO" />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" className="w-full bg-indigo-600 text-white font-bold p-3 rounded-xl hover:bg-indigo-700">Save Profile</button>
                </form>
            </div>
        </div>
    );
};

const ItemModal = ({ item, onSave, onClose, onDelete }) => {
    const [formData, setFormData] = useState({ name: '', category: '', location: '', price: '0', notes: '', isListed: false });

    useEffect(() => {
        if (item) setFormData({ ...item });
        else setFormData({ name: '', category: '', location: '', price: '0', notes: '', isListed: false });
    }, [item]);

    const handleChange = (e) => {
        const { id, value, type, checked } = e.target;
        setFormData(prev => ({...prev, [id]: type === 'checkbox' ? checked : value}));
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.isListed && (!formData.price || parseFloat(formData.price) <= 0)) {
            alert("Please set a valid price to list this item.");
            return;
        }
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="modal-content bg-slate-50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-transform animate-scale-in">
                 <div className="p-6">
                    <div className="flex justify-between items-start">
                        <h2 className="text-2xl font-bold mb-6 text-slate-900">{item ? 'Edit Item' : 'Add New Item'}</h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                    </div>
                    <form id="item-form" onSubmit={handleSubmit} className="space-y-4">
                        <div><label htmlFor="name" className="modal-label">Item Name*</label><input type="text" id="name" value={formData.name} onChange={handleChange} className="modal-input" required /></div>
                        <div><label htmlFor="category" className="modal-label">Category</label><input type="text" id="category" value={formData.category} onChange={handleChange} className="modal-input" /></div>
                        <div><label htmlFor="location" className="modal-label">Location</label><input type="text" id="location" value={formData.location} onChange={handleChange} className="modal-input" /></div>
                        
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                            <div className="flex items-center justify-between">
                                 <label htmlFor="isListed" className="font-bold text-indigo-900">List this item for sale</label>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="isListed" className="sr-only peer" checked={formData.isListed} onChange={handleChange} />
                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </div>
                            </div>
                            {formData.isListed && (
                                <div className="mt-4">
                                   <label htmlFor="price" className="modal-label">Sale Price ($)</label>
                                   <input type="number" step="0.01" id="price" value={formData.price} onChange={handleChange} className="modal-input" placeholder="e.g., 299.99" />
                                </div>
                            )}
                        </div>
                        <div><label htmlFor="notes" className="modal-label">Notes</label><textarea id="notes" rows="3" value={formData.notes} onChange={handleChange} className="modal-input"></textarea></div>
                    </form>
                </div>
                 <div className="bg-white/80 backdrop-blur-lg p-4 sticky bottom-0 rounded-b-2xl border-t border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>{item && <button type="button" onClick={() => onDelete(item)} className="text-red-600 font-semibold px-4 py-2 rounded-lg hover:bg-red-50">Delete</button>}</div>
                        <button type="submit" form="item-form" className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-700">Save Item</button>
                    </div>
                 </div>
            </div>
        </div>
    );
};

const MessagesPage = ({ user, activeChatId, setActiveChatId }) => {
    const [chats, setChats] = useState([]);

    useEffect(() => {
        const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const chatsData = await Promise.all(snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                const otherUserId = data.participants.find(id => id !== user.uid);
                if (!otherUserId) return null;
                const userDoc = await getDoc(doc(db, 'users', otherUserId));
                return { id: docSnap.id, ...data, otherUser: userDoc.data() };
            }));
            setChats(chatsData.filter(Boolean));
        });
        return () => unsubscribe();
    }, [user.uid]);

    return (
        <main className="grid grid-cols-1 md:grid-cols-3 h-[calc(100vh-81px)]">
            <div className={`col-span-1 border-r border-slate-200 overflow-y-auto ${activeChatId && 'hidden md:block'}`}>
                 <div className="p-4 border-b border-slate-200"><h2 className="text-xl font-bold">Messages</h2></div>
                 {chats.map(chat => (
                     <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`p-4 cursor-pointer hover:bg-slate-50 border-b border-slate-200 ${activeChatId === chat.id && 'bg-indigo-50'}`}>
                        <p className="font-bold">{chat.otherUser?.username || 'User'}</p>
                        <p className="text-sm text-slate-500 truncate">{chat.lastMessage?.text}</p>
                     </div>
                 ))}
            </div>
            <div className={`md:col-span-2 flex flex-col ${!activeChatId && 'hidden md:flex'}`}>
                {activeChatId ? <ChatWindow chatId={activeChatId} user={user} onBack={() => setActiveChatId(null)} /> : 
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500">
                    <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.455.09-.934.09-1.423A9.975 9.975 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                    <p>Select a conversation to start chatting.</p>
                </div>}
            </div>
        </main>
    );
};

const ChatWindow = ({ chatId, user, onBack }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    
    useEffect(() => {
        const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => doc.data()));
        });
        return () => unsubscribe();
    }, [chatId]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '') return;
        
        const messageData = { text: newMessage, senderId: user.uid, timestamp: serverTimestamp() };

        await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
        await updateDoc(doc(db, 'chats', chatId), { lastMessage: messageData });
        
        setNewMessage('');
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center p-4 border-b border-slate-200 md:hidden">
                <button onClick={onBack} className="mr-4"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
                <h3 className="font-bold">Messages</h3>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md ${msg.senderId === user.uid ? 'message-bubble-sent' : 'message-bubble-received'}`}>{msg.text}</div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white">
                <div className="flex items-center space-x-2">
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="modal-input flex-1" />
                    <button type="submit" className="bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg></button>
                </div>
            </form>
        </div>
    );
};

const AuthComponent = ({ setAuthError }) => {
    const [view, setView] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAuthAction = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        setAuthError('');
        try {
            if (view === 'signup') await createUserWithEmailAndPassword(auth, email, password);
            else if (view === 'login') await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setAuthError(error.message.replace('Firebase: ', ''));
        } finally {
            setIsProcessing(false);
        }
    };
    
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">{view === 'login' ? 'Sign In' : 'Sign Up'}</h2>
                <form onSubmit={handleAuthAction} className="space-y-4">
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="modal-input" />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="modal-input" />
                    <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white font-bold p-3 rounded-xl hover:bg-indigo-700 disabled:bg-indigo-400">
                        {isProcessing ? '...' : (view === 'login' ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>
                <p className="text-center text-sm text-slate-600 mt-6">
                    {view === 'login' ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} className="font-semibold text-indigo-600 hover:underline ml-1">
                        {view === 'login' ? 'Sign Up' : 'Sign In'}
                    </button>
                </p>
            </div>
        </div>
    );
};

const DeleteConfirmationModal = ({ item, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60] animate-fade-in">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center transform animate-scale-in">
            <h3 className="text-lg font-medium text-gray-900">Delete Item</h3>
            <p className="mt-2 text-sm text-gray-500">Are you sure you want to delete <strong>{item.name}</strong>? This cannot be undone.</p>
            <div className="mt-6 flex justify-center space-x-4">
                <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 font-bold px-6 py-2 rounded-xl hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={onConfirm} className="bg-red-600 text-white font-bold px-6 py-2 rounded-xl hover:bg-red-700">Delete</button>
            </div>
        </div>
    </div>
);

export default App;

