import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInAnonymously,
    signInWithCustomToken 
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    doc, 
    onSnapshot, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    setLogLevel
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// --- Firebase Configuration ---
// These global variables are provided by the environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'docket-plus-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
setLogLevel('debug');


// --- Helper Components ---

const StatCard = ({ label, value, icon }) => (
    <div className="stat-card bg-white rounded-2xl p-4 text-center border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-500">{label}</h2>
        <p className="text-3xl font-extrabold text-indigo-600">{value}</p>
    </div>
);

const ItemCard = ({ item, onEdit, view }) => {
    const priceFormatted = item.price ? parseFloat(item.price).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'N/A';
    const lentBadge = <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full mt-1 inline-block">Lent Out</span>;

    if (view === 'grid') {
        const photoUrl = item.photo || 'https://placehold.co/600x400/f1f5f9/cbd5e1?text=No+Image';
        return (
            <div className="item-card grid-card bg-white rounded-2xl flex flex-col animated-element hover:shadow-lg hover:-translate-y-1 cursor-pointer" onClick={() => onEdit(item)}>
                <img src={photoUrl} alt={item.name} className="item-photo" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/600x400/f1f5f9/cbd5e1?text=No+Image'; }} />
                <div className="item-content w-full">
                    <p className="font-bold text-slate-900 truncate">{item.name}</p>
                    <p className="text-sm text-slate-500 truncate">{item.category || 'No Category'}</p>
                    <div className="flex justify-between items-center mt-2">
                        <p className="font-bold text-indigo-600 text-sm">{priceFormatted}</p>
                        {item.lentTo && lentBadge}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="item-card bg-white p-4 rounded-2xl flex items-center space-x-4 mb-3 animated-element hover:shadow-lg hover:-translate-y-1 cursor-pointer" onClick={() => onEdit(item)}>
            <div className="w-16 h-16 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center">
                 {item.photo ? (
                    <img src={item.photo} alt={item.name} className="w-full h-full object-cover rounded-xl" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}/>
                ) : (
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5" /></svg>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{item.name}</p>
                <p className="text-sm text-slate-500">{item.category || 'No Category'} • {item.location || 'No Location'}</p>
            </div>
            <div className="text-right">
                <p className="font-bold text-indigo-600">{priceFormatted}</p>
                {item.lentTo && lentBadge}
            </div>
        </div>
    );
};

const ItemModal = ({ item, isOpen, onClose, onSave, onDelete, onLend }) => {
    const [formData, setFormData] = useState({});
    const [photoFile, setPhotoFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            setFormData({
                name: '', category: '', location: '', purchaseDate: '', price: '', notes: '', photo: ''
            });
        }
        setPhotoFile(null);
    }, [item]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id.replace('item-', '')]: value }));
    };

    const handlePhotoChange = (e) => {
        if (e.target.files[0]) {
            setPhotoFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let finalData = { ...formData };

        if (photoFile) {
            setIsUploading(true);
            try {
                const photoURL = await handlePhotoUpload(photoFile, item?.userId || auth.currentUser.uid);
                finalData.photo = photoURL;
            } catch (error) {
                console.error("Error uploading photo: ", error);
                setIsUploading(false);
                // Optionally show an error toast to the user
                return;
            }
            setIsUploading(false);
        }
        
        onSave(finalData);
    };

    const handlePhotoUpload = async (file, userId) => {
        if (!file || !userId) return;
        const storageRef = ref(storage, `artifacts/${appId}/users/${userId}/photos/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    };

    if (!isOpen) return null;

    const modalTitle = item ? "Edit Item" : "Add New Item";

    return (
        <div className="animated-element fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="modal-content animated-element bg-slate-50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform">
                <div className="p-6">
                    <div className="flex justify-between items-start">
                        <h2 className="text-2xl font-bold mb-6 text-slate-900">{modalTitle}</h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 animated-element">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    </div>
                    
                    {item?.lentTo && (
                        <div className="mb-4 p-4 rounded-xl bg-amber-100 border border-amber-200 text-sm">
                            Lent to <b>{item.lentTo.name}</b> on {item.lentTo.date}.
                        </div>
                    )}

                    <form id="item-form" className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="item-name" className="block text-sm font-medium text-slate-700 mb-1">Item Name*</label>
                            <input type="text" id="item-name" value={formData.name || ''} onChange={handleChange} className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500" required />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="item-category" className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                <input type="text" id="item-category" list="category-list" value={formData.category || ''} onChange={handleChange} placeholder="e.g., Electronics" className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                                <datalist id="category-list"><option value="Electronics"></option><option value="Furniture"></option><option value="Tools"></option><option value="Kitchen"></option><option value="Clothing"></option><option value="Documents"></option><option value="Heirlooms"></option><option value="Books"></option></datalist>
                            </div>
                            <div>
                                <label htmlFor="item-location" className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                                <input type="text" id="item-location" value={formData.location || ''} onChange={handleChange} placeholder="e.g., Garage Shelf" className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="item-purchaseDate" className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label>
                                <input type="date" id="item-purchaseDate" value={formData.purchaseDate || ''} onChange={handleChange} className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label htmlFor="item-price" className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
                                <input type="number" step="0.01" id="item-price" value={formData.price || ''} onChange={handleChange} placeholder="e.g., 299.99" className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="item-photo-upload" className="block text-sm font-medium text-slate-700 mb-1">Photo</label>
                            <input type="file" id="item-photo-upload" onChange={handlePhotoChange} accept="image/*" className="w-full p-2 bg-white border border-slate-300 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                        </div>
                        <div>
                            <label htmlFor="item-notes" className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                            <textarea id="item-notes" rows="3" value={formData.notes || ''} onChange={handleChange} placeholder="e.g., Model #, serial number, etc." className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"></textarea>
                        </div>
                    </form>
                </div>
                <div className="bg-white/80 backdrop-blur-lg p-4 sticky bottom-0 rounded-b-2xl border-t border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                           {item && <button type="button" onClick={() => onDelete(item.id)} className="text-red-600 font-semibold px-4 py-2 rounded-lg hover:bg-red-50 animated-element">Delete</button>}
                        </div>
                        <div className="flex items-center space-x-2">
                            {item && <button type="button" onClick={() => onLend(item)} className="bg-white border border-slate-300 text-slate-700 font-bold px-6 py-3 rounded-xl hover:bg-slate-100 animated-element">{item.lentTo ? 'Mark as Returned' : 'Lend'}</button>}
                            <button type="submit" form="item-form" className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-700 animated-element shadow-lg shadow-indigo-500/30" disabled={isUploading}>
                                {isUploading ? 'Uploading...' : 'Save Item'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Toast = ({ message, isVisible }) => {
    if (!isVisible) return null;
    return (
        <div id="toast" className="fixed bottom-0 right-0 m-8 p-4 rounded-xl bg-slate-900 text-white shadow-2xl z-50 animated-element">
            <p>{message}</p>
        </div>
    );
};


// --- Main App Component ---

export default function App() {
    const [user, setUser] = useState(null);
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [quickFilter, setQuickFilter] = useState('all'); // 'all' or 'lent'
    const [view, setView] = useState(localStorage.getItem('docket-view-preference') || 'list');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const [toast, setToast] = useState({ message: '', isVisible: false });

    // --- Authentication Effect ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Authentication failed:", error);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // --- Data Fetching Effect ---
    useEffect(() => {
        if (!user) return;
        setIsLoading(true);
        const itemsCollectionPath = `artifacts/${appId}/users/${user.uid}/items`;
        const q = query(collection(db, itemsCollectionPath));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Note: If sorting is needed, it should be done client-side to avoid complex Firestore indexing.
            // For example: fetchedItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setItems(fetchedItems);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching items:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // --- UI Handlers ---

    const showToast = (message) => {
        setToast({ message, isVisible: true });
        setTimeout(() => setToast({ message: '', isVisible: false }), 3000);
    };

    const handleSetView = (newView) => {
        setView(newView);
        localStorage.setItem('docket-view-preference', newView);
    };

    const openModal = (item = null) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setEditingItem(null);
        setIsModalOpen(false);
    };

    // --- CRUD Operations ---
    
    const getItemsCollectionRef = useCallback(() => {
        if (!user) return null;
        return collection(db, `artifacts/${appId}/users/${user.uid}/items`);
    }, [user]);

    const handleSaveItem = async (itemData) => {
        const itemsCollection = getItemsCollectionRef();
        if (!itemsCollection) return;
        
        const dataToSave = { ...itemData, userId: user.uid };
        
        if (dataToSave.id) {
            const docRef = doc(db, itemsCollection.path, dataToSave.id);
            delete dataToSave.id; // Don't save the id inside the document itself
            await updateDoc(docRef, dataToSave);
            showToast('Item updated successfully!');
        } else {
            delete dataToSave.id;
            await addDoc(itemsCollection, {
                ...dataToSave,
                createdAt: new Date().toISOString() // for potential sorting later
            });
            showToast('Item added successfully!');
        }
        closeModal();
    };
    
    const handleDeleteItem = async (itemId) => {
         const itemsCollectionPath = getItemsCollectionRef()?.path;
         if (!itemsCollectionPath) return;

        // Custom modal for confirmation instead of window.confirm
        const userConfirmed = window.confirm('Are you sure you want to delete this item? This action is permanent.');
        if (userConfirmed) {
            const docRef = doc(db, itemsCollectionPath, itemId);
            await deleteDoc(docRef);
            showToast('Item deleted.');
            closeModal();
        }
    };

    const handleLendItem = async (item) => {
        const itemsCollectionPath = getItemsCollectionRef()?.path;
        if (!itemsCollectionPath) return;

        const docRef = doc(db, itemsCollectionPath, item.id);
        if (item.lentTo) {
            await updateDoc(docRef, { lentTo: null });
            showToast('Item marked as returned.');
        } else {
            // Custom prompt/modal needed here as window.prompt is not ideal.
            const borrower = window.prompt("Who are you lending this to?");
            if (borrower && borrower.trim()) {
                await updateDoc(docRef, {
                    lentTo: {
                        name: borrower.trim(),
                        date: new Date().toISOString().split('T')[0]
                    }
                });
                showToast(`Item lent to ${borrower.trim()}.`);
            }
        }
        closeModal();
    };

    // --- Filtering and Display Logic ---
    const filteredItems = items.filter(item => {
        const matchesFilter = quickFilter === 'all' || (quickFilter === 'lent' && item.lentTo);
        const matchesSearch = searchQuery === '' || 
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.location || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const totalValue = items.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
    const lentCount = items.filter(item => item.lentTo).length;

    // --- Render ---

    return (
        <div id="app" className="max-w-5xl mx-auto min-h-screen bg-white shadow-xl">
             <header className="bg-white/80 backdrop-blur-lg sticky top-0 z-20 p-4 border-b border-slate-200">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-600 p-2.5 rounded-xl">
                           <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Docket Plus</h1>
                    </div>
                     <button onClick={() => showToast('Cloud Sync is now active!')} className="p-2.5 rounded-full hover:bg-slate-100 animated-element group relative">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
                       <span className="absolute top-full right-0 mt-2 w-48 bg-slate-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">
                           <b>Docket Plus:</b> Cloud Sync & Backup enabled
                       </span>
                   </button>
                </div>
            </header>
            
            <main className="p-4 md:p-6 pb-28">
                <section id="dashboard" className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                    <StatCard label="Total Items" value={items.length} />
                    <StatCard label="Total Value" value={totalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} />
                    <div className="col-span-2 md:col-span-1">
                        <StatCard label="Items Lent" value={lentCount} />
                    </div>
                </section>
                
                 <section className="mb-6">
                    <div className="relative mb-4">
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, category, location..." className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 animated-element" />
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="flex space-x-2 overflow-x-auto pb-2">
                           <button onClick={() => setQuickFilter('all')} className={`quick-filter animated-element flex-shrink-0 bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-full ${quickFilter === 'all' ? 'quick-filter-active' : ''}`}>All Items</button>
                           <button onClick={() => setQuickFilter('lent')} className={`quick-filter animated-element flex-shrink-0 bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-full ${quickFilter === 'lent' ? 'quick-filter-active' : ''}`}>Lent Out</button>
                        </div>
                        <div className="flex space-x-1 p-1 bg-slate-200 rounded-full">
                           <button onClick={() => handleSetView('list')} className={`view-btn p-1.5 rounded-full ${view === 'list' ? 'view-btn-active' : ''}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg></button>
                           <button onClick={() => handleSetView('grid')} className={`view-btn p-1.5 rounded-full ${view === 'grid' ? 'view-btn-active' : ''}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg></button>
                        </div>
                    </div>
                </section>
                
                <div id="item-list" className={view === 'grid' ? 'grid-view' : 'list-view'}>
                    {isLoading ? <p className="text-center p-8 text-slate-500">Loading your items...</p> : (
                        items.length === 0 ? (
                            <div className="text-center p-8 mt-10">
                               <img src="https://assets.website-files.com/620141da15403f7342016a24/62187063d352ce71933f4862_icon-11-illustration-developer-services-brix-templates.svg" alt="Empty docket illustration" className="w-48 h-48 mx-auto mb-4 opacity-70"/>
                                <h3 className="mt-2 text-xl font-bold text-slate-900">Your Docket is Empty</h3>
                                <p className="mt-1 text-md text-slate-500">Tap the '+' button below to add your first item.</p>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="text-center p-8 mt-10">
                                <img src="https://ouch-cdn2.icons8.com/5i_3-2dc5t6b52G4f5w5tJopx4C5s2i5O21sDgy3sV8/rs:fit:368:368/czM6Ly9pY29uczgu/b3VjaC1wcm9kLmFz/c2V0cy9zdmcvMjI0/LzRhNzU3ZGFhLTFk/MjgtNGVlNC04Y2Zk/LTc5YzM2OWRmYzA1/Mi5zdmc.png" alt="Magnifying glass illustration" className="w-48 h-48 mx-auto mb-4 opacity-70"/>
                                <h3 className="mt-2 text-xl font-bold text-slate-900">No Results Found</h3>
                                <p className="mt-1 text-md text-slate-500">Try adjusting your search or filter settings.</p>
                            </div>
                        ) : (
                            filteredItems.map(item => <ItemCard key={item.id} item={item} onEdit={openModal} view={view} />)
                        )
                    )}
                </div>

            </main>

            <button onClick={() => openModal()} className="fab animated-element fixed bottom-6 right-6 w-16 h-16 rounded-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </button>

            <ItemModal 
                item={editingItem} 
                isOpen={isModalOpen} 
                onClose={closeModal} 
                onSave={handleSaveItem}
                onDelete={handleDeleteItem}
                onLend={handleLendItem}
            />

            <Toast message={toast.message} isVisible={toast.isVisible} />
        </div>
    );
}
