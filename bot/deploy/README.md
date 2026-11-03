# Héberger le bot gratuitement (Google Cloud, machine e2-micro)

Le bot tourne sur une petite machine virtuelle de l'offre gratuite « Always Free » de Google Cloud, dans le même
projet que Firebase (`tsukuyomi-hub`). Tout se fait dans le navigateur : rien à installer sur ton ordinateur.

## Ce qui reste gratuit

L'offre gratuite couvre **une** machine `e2-micro`, avec un disque **standard** de 30 Go maximum, dans l'une de ces régions :
`us-central1` (Iowa), `us-east1` (Caroline du Sud) ou `us-west1` (Oregon). Le bot échange très peu de données, il reste dans les quotas.
Google demande une carte bancaire pour activer la facturation, mais ne prélève rien tant qu'on reste dans ces limites.
Avec un autre type de machine, de disque ou de région, la machine devient payante.

## 1. Activer la facturation et Compute Engine

1. Ouvrir https://console.cloud.google.com/ et choisir le projet **tsukuyomi-hub** en haut de la page.
2. Menu ☰ → **Facturation** : associer un compte de facturation au projet (carte bancaire).
3. Menu ☰ → **Compute Engine** → **Activer** l'API. L'activation prend une minute.

## 2. Créer le compte de service du bot

La machine utilise ce compte pour lire et écrire dans Firestore. Avec lui, il n'y a **pas de clé à copier** sur le serveur.

1. Menu ☰ → **IAM et administration** → **Comptes de service** → **Créer un compte de service**.
2. Nom : `tsukuyomi-bot` → **Créer et continuer**.
3. Rôle : **Utilisateur Cloud Datastore** (*Cloud Datastore User*) → **Continuer** → **OK**.

## 3. Créer la machine

Menu ☰ → **Compute Engine** → **Instances de VM** → **Créer une instance**, puis remplir :

| Réglage | Valeur |
|---|---|
| Nom | `tsukuyomi-bot` |
| Région | `us-central1` (ou `us-east1`, `us-west1`) |
| Série / type de machine | **E2** / **e2-micro** |
| Disque de démarrage | **Modifier** → Debian GNU/Linux 12, type **Disque persistant standard**, **30 Go** |
| Compte de service (section *Sécurité* / *Identité et accès aux API*) | `tsukuyomi-bot` |
| Niveaux d'accès | **Autoriser l'accès complet à l'ensemble des API Cloud** (le rôle de l'étape 2 limite déjà les droits à Firestore) |
| Pare-feu | ne rien cocher : le bot n'a besoin d'aucun port ouvert |

Cliquer sur **Créer**. Une fois la machine démarrée, le bouton **SSH** de sa ligne ouvre un terminal dans le navigateur.

## 4. Récupérer le code sur la machine

Dans le terminal SSH :

```bash
sudo apt-get update && sudo apt-get install -y git
```

**Si le dépôt GitHub est public :**

```bash
git clone https://github.com/yaeldreen/tsukuyomi-hub.git ~/tsukuyomi-hub
```

**Si le dépôt est privé**, il faut une clé de déploiement en lecture seule :

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C tsukuyomi-bot
cat ~/.ssh/id_ed25519.pub
```

Copier la ligne affichée, puis sur GitHub : dépôt → **Settings** → **Deploy keys** → **Add deploy key**. Coller la ligne et **ne pas** cocher *Allow write access*. Ensuite :

```bash
git clone git@github.com:yaeldreen/tsukuyomi-hub.git ~/tsukuyomi-hub
```

Répondre `yes` à la question sur l'empreinte de github.com.

## 5. Installer et lancer le bot

```bash
bash ~/tsukuyomi-hub/bot/deploy/setup-vm.sh
```

Le script :
1. installe Node.js 22 ;
2. installe les dépendances du bot ;
3. demande le **jeton Discord** (rien ne s'affiche pendant la saisie, c'est normal), le rôle éditeur et le nom du salon ;
4. lance le bot comme service : il redémarre tout seul en cas de plantage ou de redémarrage de la machine.

Le message « Connecté en tant que … » doit apparaître dans le journal :

```bash
sudo journalctl -u tsukuyomi-bot -f
```

(Ctrl+C pour quitter le journal ; le bot continue de tourner.)

Une fois que le bot tourne sur la machine, **arrête celui de ton ordinateur**. Sinon, chaque commande reçoit deux réponses.

## Mettre à jour le bot

Après chaque `git push` sur GitHub, dans le terminal SSH de la machine :

```bash
bash ~/tsukuyomi-hub/bot/deploy/update.sh
```

## Commandes utiles

| Action | Commande |
|---|---|
| Voir s'il tourne | `sudo systemctl status tsukuyomi-bot` |
| Journal en direct | `sudo journalctl -u tsukuyomi-bot -f` |
| Redémarrer | `sudo systemctl restart tsukuyomi-bot` |
| Arrêter | `sudo systemctl stop tsukuyomi-bot` |
| Changer le jeton ou le rôle | `nano ~/tsukuyomi-hub/bot/.env` puis redémarrer |
