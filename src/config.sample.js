// Fichier de configuration pour omada2mqtt

module.exports = {
  // Configuration pour le contrôleur Omada
  omada: {
    baseUrl: 'https://<IP_DU_CONTROLEUR>:8043', // Mettez l'IP ou le nom d'hôte de votre contrôleur
    client_id: "CLIENT_ID", // ID client pour l'authentification
    client_secret: "CLIENT_SECRET", // Secret client pour l'authentification
    omadac_id: "OMADA_ID", // ID de l'instance Omada
    site: 'Default' // Le nom de votre site dans Omada, "Default" est la valeur par défaut
  },

  // Configuration pour le broker MQTT
  mqtt: {
    url: 'mqtt://<IP_DU_BROKER>', // Mettez l'IP ou le nom d'hôte de votre broker MQTT
    username: 'VOTRE_UTILISATEUR_MQTT', // Laissez vide si pas d'authentification
    password: 'VOTRE_MOT_DE_PASSE_MQTT', // Laissez vide si pas d'authentification
    baseTopic: 'omada' // Le topic de base pour les messages
  }
};
