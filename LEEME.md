# Correlativas · Ingeniería Industrial

App para móvil del Plan 2023, lista para publicar en GitHub Pages. No necesita instalar paquetes ni compilar. Incluye 42 obligatorias, 12 electivas, estados pendiente/cursando/regular/aprobada, notas y fechas opcionales, detalle de requisitos, progreso, créditos y respaldos.

## Firebase

La app ya incluye la configuración web del proyecto Firebase `plan-del-ingeniero`. No necesitás reemplazar `firebase-config.js` ni volver a copiar el objeto de configuración. La app sigue guardando el avance en este navegador hasta que actives los servicios siguientes.

Antes de que funcionen las cuentas y la sincronización, en [Firebase Console](https://console.firebase.google.com/) verificá:

1. Conservá el plan **Spark**, sin activar facturación. Google Analytics no hace falta.
2. En **Authentication → Sign-in method**, habilitá **Correo electrónico/contraseña**. La app incluye crear cuenta, iniciar sesión y recuperar la contraseña. No requiere teléfono ni SMS.
3. En **Firestore Database**, creá una base **Cloud Firestore Standard**, en **modo producción**, con el identificador predeterminado `(default)`. Elegí la región con cuidado; esa elección es permanente para la base.
4. En la pestaña **Rules** de Firestore, reemplazá las reglas por el contenido completo de `firestore.rules` y publicalas. Cada usuario solo puede leer y modificar sus propios datos. No uses reglas abiertas ni modo de prueba para la app publicada.
5. En **Authentication → Settings → Authorized domains**, agregá `TU_USUARIO.github.io` (sin `https://` ni el nombre del repositorio). Si usás un dominio propio, agregalo también. Para probar localmente, podés agregar `localhost` temporalmente.
6. Publicá los archivos en GitHub Pages y creá una cuenta dentro de la app. La pantalla Mi cuenta debe mostrar **Sincronizado con tu cuenta** luego de cargar los datos.

La configuración de una app web de Firebase incluida en `firebase-config.js` es pública; no es una clave de administración. Nunca pongas archivos de cuenta de servicio, contraseñas, tokens de GitHub o claves privadas en este proyecto. La protección de las notas depende de Firebase Authentication y de las reglas incluidas.

**Cuotas consultadas:** Firebase Spark indica que no necesita medio de pago. Cloud Firestore ofrece 1 GiB de datos, 50.000 lecturas y 20.000 escrituras diarias gratis. El progreso de una carrera ocupa muy poco espacio. Las cuotas se comparten entre usuarios del mismo proyecto; al agotarlas pueden detenerse operaciones hasta su renovación. Un plan gratuito no garantiza disponibilidad indefinida ni ausencia de cambios en sus condiciones.

Fuentes oficiales: [precios de Firebase](https://firebase.google.com/pricing), [cuotas de Firestore](https://firebase.google.com/docs/firestore/pricing), [configuración web](https://firebase.google.com/docs/web/setup), [inicio de sesión con correo](https://firebase.google.com/docs/auth/web/password-auth).

## Publicar en GitHub Pages

1. Descomprimí el ZIP.
2. Creá un repositorio público en GitHub (o usá uno tuyo que ya tenga Pages disponible).
3. Subí **el contenido de la carpeta `correlativas` a la raíz del repositorio**. `index.html` debe quedar en la raíz, no adentro de otra carpeta. Incluí todos los archivos, también `.nojekyll`.
4. En el repositorio, abrí **Settings → Pages**. Elegí **Deploy from a branch**, rama `main`, carpeta `/(root)`, y guardá.
5. Cuando termine el despliegue, la dirección será `https://TU_USUARIO.github.io/NOMBRE_REPOSITORIO/`.
6. Abrila en el teléfono. Podés agregarla a la pantalla de inicio desde el menú del navegador.

Los enlaces y archivos usan rutas relativas, así que funcionan dentro del nombre del repositorio. No hace falta un dominio pago. [Guía oficial de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Para actualizar, reemplazá los archivos en el repositorio. Si modificás los archivos de la app, incrementá `VERSION` en `sw.js`. La caché usa red primero y mantiene una copia para abrir la interfaz sin conexión. Cerrá las pestañas anteriores y volvé a abrir después de una actualización.

## Uso

- Tocá una materia, elegí estado y guardá. La nota y la fecha son opcionales.
- Las pendientes bloqueadas aparecen rojas; las habilitadas, neutras; cursando, azul; regular, ámbar; aprobada, verde. También tienen texto e íconos para no depender solo del color.
- La búsqueda recorre todo el plan, incluso otros niveles. Los filtros de estado se aplican al nivel seleccionado o a los resultados de búsqueda.
- **Disponibles** separa materias para cursar y finales para rendir. **Progreso** muestra obligatorias, créditos de electivas, título intermedio y horas de PPS.
- Antes de iniciar sesión, el progreso es local. Después, podés copiarlo a tu cuenta mediante **Pasar ese avance a mi cuenta**. La app pide confirmar si va a reemplazar registros existentes.
- Cada cuenta tiene datos separados. Los cambios de una materia se sincronizan de forma independiente; si dos dispositivos cambian la misma materia, prevalece la última escritura que recibe Firestore.
- La casilla “Este dispositivo es mío” permite recordar sesión y habilita la copia persistente de Firestore en ese navegador. Sin esa opción, la sesión es temporal y la caché en memoria. No cierres la app con cambios pendientes si no activaste la copia persistente.
- Exportar genera un JSON con estados, notas, fechas y otros requisitos. Importar reemplaza solo las materias incluidas y los otros requisitos; conserva las materias ausentes del archivo. La app valida que el respaldo pertenezca a este plan.
- El registro de horas es personal: no acredita automáticamente la PPS.

## Interpretación de las correlativas

Se implementó la regla acordada en la conversación:

- **Para cursar:** todas las materias de la columna **Regular** deben estar regulares o aprobadas.
- **Para rendir:** la propia materia debe estar regular (o aprobada), y todas las de la columna **Aprobada** deben estar aprobadas. La lista de finales disponibles muestra únicamente materias regulares.

**El PDF no explica formalmente el alcance de las columnas.** Antes de usar el resultado para una inscripción, confirmá con la facultad si las columnas son requisitos conjuntos para cursar. Si lo fueran, debe ajustarse `eligibility()` en `engine.js` y la explicación en la interfaz. La app muestra esta limitación en “Cómo funcionan las correlativas”.

No se inventaron vencimientos de regularidad ni requisitos de promoción. Se permite cargar el historial aunque no estén ingresadas las materias anteriores. Corregir una materia recalcula los desbloqueos y nunca borra automáticamente otras aprobaciones.

## Transcripción del PDF

- Fuente completa: `plan-2023.pdf`, provisto por el usuario, encabezados CET/AETI, Plan 2023.
- Los resaltados de colores del PDF no se convirtieron en estados iniciales.
- Instalaciones Industriales (34) y Legislación (35) están en **cuarto nivel**, según las líneas de la tabla original.
- En Proyecto Final, el salto de línea `3 / 0` corresponde a la materia **30**; en Análisis de Datos I, `3 / 3` corresponde a **33**; en CNH, `1 / 9` corresponde a **19**.
- “CNH CÁTEDRA IN STU” se conservó tal como aparece en el documento.
- Gestión Industrial no figura como fila con correlativas en el PDF: se registra como requisito independiente del título intermedio, junto con la aprobación de 1.º a 3.º.
- La PPS usa el mínimo de 200 horas y muestra si se cumplieron ambas columnas de requisitos académicos de Proyecto Final. No se agregó la PPS como correlativa de Proyecto Final, porque el documento no lo especifica así.
- Las cargas horarias se muestran sin asumir una unidad semanal que el PDF no declara.

## Estructura

`data.js`: plan transcripto. `engine.js`: requisitos, métricas y validación. `app.js`: pantallas e interacciones. `cloud.js`: conexión al SDK oficial de Firebase, sesiones y documentos por usuario. `firestore.rules`: aislamiento y validación de datos. `styles.css`: diseño móvil, accesibilidad y movimiento reducido. `sw.js` y `manifest.webmanifest`: acceso desde pantalla de inicio y caché.

La app expone, cuando el navegador lo admite, una herramienta WebMCP de consulta de correlativas de solo lectura. No modifica estados.

## Ejecutar en una computadora

Abrí la carpeta con un servidor web local (por ejemplo, Live Server de VS Code). No abras `index.html` con doble clic: los módulos de JavaScript necesitan `http://` o `https://`. No hay un proceso de compilación.

## Comprobaciones realizadas

Se verificaron los 54 identificadores y todas sus referencias, los saltos de línea del PDF, desbloqueo y rebloqueo, requisitos de finales, créditos, promedio y validación de respaldos válidos e inválidos. En navegador se probó cambiar estados, guardar nota y fecha, conservar el avance al recargar, buscar sin tildes en otros niveles y actualizar el resumen. Se revisó la ausencia de desbordamiento horizontal en 320 y 390 píxeles. Se comprobó la herramienta de consulta con IDs válidos y con uno inexistente. Los datos de prueba se devolvieron a pendiente y sin nota ni fecha.

La configuración web del proyecto Firebase está incluida. Authentication, Firestore y sus reglas deben habilitarse en la consola y necesitan una prueba final en el dominio publicado. No se accedió a tu consola ni se modificó la base de datos. La instalación PWA y el modo sin conexión completo también necesitan comprobarse en el dominio HTTPS publicado.
