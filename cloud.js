// SDK oficial modular; se carga únicamente si hay un proyecto configurado.
export async function createCloud(config, callbacks) {
  const root='https://www.gstatic.com/firebasejs/12.19.0/';
  const [appSDK,authSDK,dbSDK]=await Promise.all([
    import(root+'firebase-app.js'),import(root+'firebase-auth.js'),import(root+'firebase-firestore.js')
  ]);
  const existing=appSDK.getApps().find(value=>value.name==='correlativas');
  if(existing)await appSDK.deleteApp(existing);
  const app=appSDK.initializeApp(config,'correlativas');
  const auth=authSDK.getAuth(app);
  let db, currentUser, stopCourses, stopProfile;
  const getDB=()=>{
    if(!db){
      let trusted=false;try{trusted=localStorage.getItem('correlativas:trusted')==='yes';}catch{}
      db=dbSDK.initializeFirestore(app,{localCache:trusted?dbSDK.persistentLocalCache({tabManager:dbSDK.persistentMultipleTabManager()}):dbSDK.memoryLocalCache()});
    }
    return db;
  };
  const requireUser=()=>{if(!currentUser)throw new Error('Primero iniciá sesión.');return currentUser.uid;};
  authSDK.onAuthStateChanged(auth,user=>{
    stopCourses?.();stopProfile?.();currentUser=user;callbacks.user(user);
    if(!user)return;
    const uid=user.uid;
    stopCourses=dbSDK.onSnapshot(dbSDK.collection(getDB(),'users',uid,'courses'),{includeMetadataChanges:true},snapshot=>{
      if(currentUser?.uid!==uid)return;
      callbacks.records(Object.fromEntries(snapshot.docs.map(d=>[d.id,d.data()])),{pending:snapshot.metadata.hasPendingWrites,cache:snapshot.metadata.fromCache});
    },callbacks.error);
    stopProfile=dbSDK.onSnapshot(dbSDK.doc(getDB(),'users',uid,'profile','progress'),snapshot=>{
      if(currentUser?.uid===uid)callbacks.milestones(snapshot.data()||{});
    },callbacks.error);
  },callbacks.error);
  return {
    async login(email,password,register,remember){
      try{localStorage.setItem('correlativas:trusted',remember?'yes':'no');}catch{}
      await authSDK.setPersistence(auth,remember?authSDK.browserLocalPersistence:authSDK.browserSessionPersistence);
      return register?authSDK.createUserWithEmailAndPassword(auth,email,password):authSDK.signInWithEmailAndPassword(auth,email,password);
    },
    resetPassword:email=>authSDK.sendPasswordResetEmail(auth,email),
    logout:()=>authSDK.signOut(auth),
    save:(id,record)=>dbSDK.setDoc(dbSDK.doc(getDB(),'users',requireUser(),'courses',id),record),
    saveMilestones:value=>dbSDK.setDoc(dbSDK.doc(getDB(),'users',requireUser(),'profile','progress'),value),
    async importRecords(records,milestones){
      const uid=requireUser(),database=getDB(),batch=dbSDK.writeBatch(database);
      for(const [id,record] of Object.entries(records)) batch.set(dbSDK.doc(database,'users',uid,'courses',id),record);
      batch.set(dbSDK.doc(database,'users',uid,'profile','progress'),milestones);
      return batch.commit();
    }
  };
}
export function friendlyError(error){
  const messages={
    'auth/invalid-credential':'El correo o la contraseña no coinciden.',
    'auth/invalid-email':'Revisá el formato del correo.',
    'auth/email-already-in-use':'Ese correo ya tiene una cuenta. Elegí Ingresar.',
    'auth/weak-password':'Usá una contraseña de al menos 6 caracteres.',
    'auth/too-many-requests':'Hubo demasiados intentos. Probá de nuevo en unos minutos.',
    'auth/network-request-failed':'No se pudo conectar. Revisá tu conexión a Internet.',
    'auth/operation-not-allowed':'Falta habilitar Correo/contraseña en Firebase Authentication.',
    'auth/unauthorized-domain':'Agregá el dominio de esta app a los dominios autorizados de Firebase.',
    'auth/invalid-api-key':'Revisá la configuración pública de Firebase.',
    'permission-denied':'Firebase rechazó el acceso. Revisá que las reglas de Firestore estén publicadas para tu usuario.',
    'resource-exhausted':'Se alcanzó una cuota gratuita de Firebase. Conservá un respaldo y volvé a intentar cuando se renueve.',
    'unavailable':'Firebase no está disponible en este momento. Los cambios quedan pendientes.',
  };
  return messages[error?.code] || error?.message || 'No se pudo completar la operación. Probá nuevamente.';
}
