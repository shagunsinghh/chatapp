import { createApp } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";
import {
  fileToGraffitiObject,
  graffitiFileSchema,
} from "@graffiti-garden/wrapper-files";
import { GraffitiObjectToFile } from "@graffiti-garden/wrapper-files/vue";

createApp({
  data() {
    return {
      pinnedSearchQuery: "",
      myMessage: "",
      sending: false,
      chatType: "group",
      activeChannel: null,
      activeChatName: "",
      dmhis: [],
      activeSender: null,
      last: {},
      pinnedMess: {},
      showPinned: false,
      showProfilePanel: false,
      profilePictureData: null,
      fileToUpload: null,
      profilePictureUrl: "",
      graffitiFileSchema,
      currentProfile: null,
      privateProfileToShow: null,
      profileObjects: [],
      group: "",
      rename: "",
      renameObjects: [],
      directMessageUser: "",
      profileName: "",
      profilePronouns: "",
      profileAge: "",
      profileLocation: "",
      myProfile: null,
      privateProfile: null,
      profileLoading: false,
      historyLoading: false,
      currentUserId: null,
      joinedGroupChats: [],
    };
  },
  components: {
    GraffitiObjectToFile,
  },

  methods: {
    setFileToUpload(e) {
      this.fileToUpload = e.target.files[0] || null;
    },

    async uploadProfilePicture(session) {
      if (!this.fileToUpload) return alert("No file selected");

      const pictureData = {
        userId: session.actor,
        timestamp: Date.now(),
      };

      const obj = await fileToGraffitiObject(this.fileToUpload, pictureData);
      const { url } = await this.$graffiti.put(obj, session);
      this.profilePictureUrl = url;
      alert("Profile picture uploaded!");
    },

    switchToGroupChat() {
      this.chatType = "group";
    },

    switchToDirectMessages() {
      this.chatType = "direct";
    },

    saveConversationHistory() {
      if (!this.currentUserId) return;

      const historyData = {
        dmhis: this.dmhis,
        last: this.last,
        pinnedMess: this.pinnedMess,
        joinedGroupChats: this.joinedGroupChats,
        profilePictureUrl: this.profilePictureUrl || "",
      };

      localStorage.setItem(
        `chatHistory_${this.currentUserId}`,
        JSON.stringify(historyData)
      );
    },

    loadConversationHistory() {
      this.dmhis = [];
      this.last = {};
      this.pinnedMess = {};
      this.joinedGroupChats = [];

      if (!this.currentUserId) return;
      this.historyLoading = true;

      try {
        const savedHistory = localStorage.getItem(
          `chatHistory_${this.currentUserId}`
        );
        if (savedHistory) {
          const historyData = JSON.parse(savedHistory);

          this.dmhis = historyData.dmhis || [];
          this.last = historyData.last || {};
          this.pinnedMess = historyData.pinnedMess || {};
          this.joinedGroupChats = historyData.joinedGroupChats || [];

          if (historyData.profilePictureUrl) {
            this.profilePictureUrl = historyData.profilePictureUrl;
          }
        }
      } catch (err) {
        console.error("Error loading conversation history:", err);
      }

      this.historyLoading = false;
    },

    async doLogout() {
      const session = this.$graffitiSession.value;
      if (!session) return;

      const userId = session.actor;

      this.saveConversationHistory();

      await this.$graffiti.logout(session);

      this.activeChannel = null;
      this.activeChatName = "";
      this.chatType = "group";

      this.showProfilePanel = false;
      this.currentProfile = null;
      this.privateProfileToShow = null;
      this.profileLoading = false;
      this.myProfile = null;
      this.privateProfile = null;
      this.currentUserId = null;

      this.dmhis = [];
      this.last = {};
      this.pinnedMess = {};
      this.joinedGroupChats = [];

      if (confirm("Do you want to log out?")) {
        const localImpl = this.$graffiti.graffiti;
        if (localImpl.clear) {
          localImpl.clear();
          this.profileObjects = [];
          this.renameObjects = [];

          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("chatHistory_")) {
              localStorage.removeItem(key);
            }
          });
        }
      }
    },

    resetProfileState() {
      this.myProfile = null;
      this.privateProfile = null;
      this.currentUserId = null;
      this.profileName = "";
      this.profilePronouns = "";
      this.profileAge = "";
      this.profileLocation = "";
      this.showProfilePanel = false;
      this.currentProfile = null;
      this.privateProfileToShow = null;
      this.profileLoading = false;
    },

    async loadExistingProfile(session) {
      if (!session) return;

      const actor = session.actor;
      this.currentUserId = actor;
      this.profileLoading = true;

      if (this.myProfile && this.myProfile.describes === this.currentUserId) {
        this.profileLoading = false;
        this.loadConversationHistory();
        return;
      } else {
        this.myProfile = null;
        this.privateProfile = null;
      }

      if (!this.profileObjects || this.profileObjects.length === 0) {
        try {
          await new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
              resolve();
            }, 2000);

            this.$graffiti.discover({
              channels: [actor, `${actor}-private`],
              schema: {
                properties: {
                  value: {
                    required: ["describes"],
                    properties: {
                      describes: { type: "string" },
                      name: { type: "string" },
                      pronouns: { type: "string" },
                      age: { type: "string" },
                      location: { type: "string" },
                      picture: { type: "string" },
                    },
                  },
                },
              },
              callback: (objects) => {
                this.profileObjects = [...this.profileObjects, ...objects];
                clearTimeout(timeout);
                resolve();
              },
            });
          });
        } catch (err) {
          console.error("Error discovering profile:", err);
        }
      }

      const publicProfile = this.profileObjects.find(
        (obj) => obj.value.describes === actor
      );

      const privateProfile = this.profileObjects.find(
        (obj) => obj.value.describes === `${actor}-private`
      );

      if (publicProfile) {
        this.myProfile = publicProfile.value;
      }

      if (privateProfile) {
        this.privateProfile = privateProfile.value;
      }

      this.profileLoading = false;
      await this.loadConversationHistory();
    },

    toggleProfilePanel() {
      if (this.chatType !== "direct") return;

      this.showProfilePanel = !this.showProfilePanel;
      if (this.showProfilePanel) {
        this.loadProfile(this.activeChannel);
      }
    },
    async toggleLikeMessage(message, session) {
      if (message.value.liked === undefined) {
        message.value.liked = false;
      }
      const newStatus = !message.value.liked;
      await this.$graffiti.patch(
        { value: [{ op: "replace", path: "/liked", value: newStatus }] },
        message,
        session
      );

      message.value.liked = newStatus;

      this.saveConversationHistory();
    },

    loadProfile(userId) {
      this.currentProfile =
        this.profileObjects.find((o) => o.value.describes === userId) || null;

      if (userId === this.$graffitiSession.value?.actor) {
        this.privateProfileToShow =
          this.profileObjects.find(
            (o) => o.value.describes === `${userId}-private`
          ) || null;
      } else {
        this.privateProfileToShow = null;
      }
    },

    displayName(userId) {
      const p = this.profileObjects.find((o) => o.value.describes === userId);
      if (p) {
        const { name, pronouns } = p.value;
        return pronouns ? `${name} (${pronouns})` : name;
      }

      const r = this.renameObjects.find((o) => o.value.describes === userId);
      if (r) {
        return r.value.name;
      }

      return userId;
    },

    async createProfile(session) {
      if (!this.profileName.trim()) {
        alert("Name is required");
        return;
      }

      this.myProfile = {
        name: this.profileName.trim(),
        pronouns: this.profilePronouns.trim() || undefined,
        describes: session.actor,
        published: Date.now(),
      };

      if (this.profilePictureUrl) {
        this.myProfile.picture = this.profilePictureUrl;
      }

      try {
        await this.$graffiti.put(
          {
            value: this.myProfile,
            channels: [session.actor],
          },
          session
        );
      } catch (err) {
        console.error("Error saving profile:", err);
        alert("Error saving profile");
        return;
      }

      if (this.profileAge.trim() || this.profileLocation.trim()) {
        this.privateProfile = {
          age: this.profileAge.trim() || undefined,
          location: this.profileLocation.trim() || undefined,
          describes: `${session.actor}-private`,
          published: Date.now(),
        };

        await this.$graffiti.put(
          {
            value: this.privateProfile,
            channels: [`${session.actor}-private`],
            allowed: [session.actor],
          },
          session
        );
      }

      this.profileName = "";
      this.profilePronouns = "";
      this.profileAge = "";
      this.profileLocation = "";
      this.profilePictureData = null;
      this.currentUserId = session.actor;

      if (
        !this.profileObjects.some((p) => p.value.describes === session.actor)
      ) {
        this.profileObjects.push({ value: this.myProfile });
      }

      if (
        this.privateProfile &&
        !this.profileObjects.some(
          (p) => p.value.describes === `${session.actor}-private`
        )
      ) {
        this.profileObjects.push({ value: this.privateProfile });
      }
    },

    async createGroupChat(session) {
      if (!this.group.trim()) {
        alert("Please enter group chat name");
        return;
      }

      const channel = crypto.randomUUID();

      await this.$graffiti.put(
        {
          value: {
            activity: "Create",
            object: {
              type: "Group Chat",
              name: this.group.trim(),
              channel,
            },
          },
          channels: ["designftw"],
        },
        session
      );

      if (!this.joinedGroupChats.includes(channel)) {
        this.joinedGroupChats.push(channel);
        this.saveConversationHistory();
      }

      alert(`Created group "${this.group.trim()}" (channel: ${channel})`);
      this.group = "";
    },

    joinGroupChat(object) {
      this.activeChannel = object.value.object.channel;

      const renamed = this.renameObjects.find(
        (r) => r.value.describes === this.activeChannel
      );

      this.activeChatName = renamed
        ? renamed.value.name
        : object.value.object.name;

      this.chatType = "group";
      this.showPinned = false;

      if (!this.joinedGroupChats.includes(this.activeChannel)) {
        this.joinedGroupChats.push(this.activeChannel);
        this.saveConversationHistory();
      }
    },

    async renameGroupChat(session) {
      if (!this.rename.trim()) {
        alert("Enter new name");
        return;
      }

      await this.$graffiti.put(
        {
          value: {
            name: this.rename.trim(),
            describes: this.activeChannel,
          },
          channels: ["designftw"],
        },
        session
      );

      const idx = this.renameObjects.findIndex(
        (o) => o.value.describes === this.activeChannel
      );

      if (idx > -1) {
        this.renameObjects[idx].value.name = this.rename.trim();
      } else {
        this.renameObjects.push({
          value: {
            name: this.rename.trim(),
            describes: this.activeChannel,
          },
        });
      }

      this.activeChatName = this.rename.trim();
      this.$nextTick(() => {
        const recipientEl = document.querySelector(".chat-recipient");
        if (recipientEl) {
          recipientEl.classList.remove("bounce-once"); // reset if already there
          void recipientEl.offsetWidth; // trigger reflow to restart animation
          recipientEl.classList.add("bounce-once");

          // optional: remove the class after animation ends
          setTimeout(() => {
            recipientEl.classList.remove("bounce-once");
          }, 600);
        }
      });
      this.rename = "";
      this.saveConversationHistory();
    },

    async sendMessage(session) {
      if (!this.myMessage || !this.activeChannel) return;
      this.sending = true;

      const payload = {
        content: this.myMessage,
        published: Date.now(),
        pinned: false,
        liked: false,
      };

      if (this.chatType === "direct") {
        payload.sender = session.actor;

        if (
          this.activeChannel !== session.actor &&
          !this.dmhis.includes(this.activeChannel)
        ) {
          this.dmhis.push(this.activeChannel);
        }

        this.last[this.activeChannel] = {
          content: this.myMessage,
          timestamp: payload.published,
        };

        this.saveConversationHistory();
      }

      await this.$graffiti.put(
        { value: payload, channels: [this.activeChannel] },
        session
      );

      this.sending = false;
      this.myMessage = "";
      await this.$nextTick();
      this.$refs.messageInput?.focus();
    },

    startDirectMessage(session) {
      if (!this.directMessageUser.trim()) {
        alert("Please enter a user ID");
        return;
      }

      this.activeChannel = this.directMessageUser;
      this.activeChatName = this.directMessageUser;
      this.chatType = "direct";
      this.activeSender = null;
      this.showPinned = false;

      if (!this.dmhis.includes(this.directMessageUser)) {
        this.dmhis.push(this.directMessageUser);
        this.saveConversationHistory();
      }

      this.directMessageUser = "";
    },

    viewMyInbox(session) {
      this.activeChannel = session.actor;
      this.activeChatName = "My Inbox";
      this.chatType = "direct";
      this.activeSender = null;
      this.showPinned = false;
    },

    async showProfile(actor) {
      if (!actor) return;

      try {
        this.currentProfile = null;
        this.privateProfileToShow = null;

        let publicProfile = this.profileObjects.find(
          (obj) => obj.value && obj.value.describes === actor
        );

        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve();
          }, 2000);

          this.$graffiti.discover({
            channels: [actor],
            schema: {
              properties: {
                value: {
                  required: ["describes"],
                  properties: {
                    describes: { type: "string" },
                    name: { type: "string" },
                    pronouns: { type: "string" },
                    picture: { type: "string" },
                  },
                },
              },
            },
            callback: (objects) => {
              objects.forEach((obj) => {
                const existingIndex = this.profileObjects.findIndex(
                  (existingObj) =>
                    existingObj.value.describes === obj.value.describes
                );

                if (existingIndex >= 0) {
                  this.profileObjects.splice(existingIndex, 1);
                }

                this.profileObjects.push(obj);
              });

              clearTimeout(timeout);
              resolve();
            },
          });
        });

        publicProfile = this.profileObjects.find(
          (obj) => obj.value && obj.value.describes === actor
        );

        let privateProfile = null;
        if (actor === this.$graffitiSession.value?.actor) {
          await new Promise((resolve) => {
            const timeout = setTimeout(() => {
              resolve();
            }, 2000);

            this.$graffiti.discover({
              channels: [`${actor}-private`],
              schema: {
                properties: {
                  value: {
                    required: ["describes"],
                    properties: {
                      describes: { type: "string" },
                      age: { type: "string" },
                      location: { type: "string" },
                    },
                  },
                },
              },
              callback: (objects) => {
                objects.forEach((obj) => {
                  const existingIndex = this.profileObjects.findIndex(
                    (existingObj) =>
                      existingObj.value.describes === obj.value.describes
                  );

                  if (existingIndex >= 0) {
                    this.profileObjects.splice(existingIndex, 1);
                  }

                  this.profileObjects.push(obj);
                });

                clearTimeout(timeout);
                resolve();
              },
            });
          });

          privateProfile = this.profileObjects.find(
            (obj) => obj.value && obj.value.describes === `${actor}-private`
          );
        }

        if (publicProfile) {
          this.currentProfile = publicProfile;
        }

        if (actor === this.$graffitiSession.value?.actor && privateProfile) {
          this.privateProfileToShow = privateProfile;
        }

        this.showProfilePanel = true;
        this.$nextTick(() => {
          this.$forceUpdate();
        });
      } catch (err) {
        console.error("Error in showProfile:", err);
        this.currentProfile = null;
        this.privateProfileToShow = null;
        this.showProfilePanel = true;
      }
    },

    onProfilePictureChange(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("Image file size must be less than 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.profilePictureData = e.target.result;
      };
      reader.onerror = (e) => {
        console.error("Error reading file:", e);
        alert("Error reading file");
      };

      reader.readAsDataURL(file);
    },

    async editMessage(message) {
      const newContent = prompt("Edit message:", message.value.content);
      if (!newContent || newContent === message.value.content) return;

      await this.$graffiti.patch(
        {
          value: [{ op: "replace", path: "/content", value: newContent }],
        },
        message,
        this.$graffitiSession.value
      );

      message.value.content = newContent;

      if (message.value.pinned && this.pinnedMess[this.activeChannel]) {
        const idx = this.pinnedMess[this.activeChannel].findIndex(
          (m) => m.url === message.url
        );

        if (idx > -1) {
          this.pinnedMess[this.activeChannel][idx].value.content = newContent;
          this.saveConversationHistory();
        }
      }
    },

    async deleteMessage(message) {
      if (!confirm("Do you want to delete this message?")) return;

      await this.$graffiti.delete(message, this.$graffitiSession.value);

      if (message.value.pinned && this.pinnedMess[this.activeChannel]) {
        this.pinnedMess[this.activeChannel] = this.pinnedMess[
          this.activeChannel
        ].filter((m) => m.url !== message.url);

        this.saveConversationHistory();
      }
    },

    openConversation(userId, session) {
      this.activeChannel = userId;
      this.activeChatName = userId;
      this.chatType = "direct";
      this.activeSender = null;
      this.showPinned = false;
    },

    filterBySender(sender) {
      this.activeSender = this.activeSender === sender ? null : sender;
    },

    formatTime(ts) {
      return new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    sortedConversations() {
      return this.dmhis.sort((a, b) => {
        const ta = this.last[a]?.timestamp || 0;
        const tb = this.last[b]?.timestamp || 0;
        return tb - ta;
      });
    },

    processIncomingMessages(messages, session) {
      let updated = false;

      messages.forEach((m) => {
        const sender = m.value.sender;
        if (!sender || sender === session.actor) return;

        if (!this.dmhis.includes(sender)) {
          this.dmhis.push(sender);
          updated = true;
        }

        if (
          !this.last[sender] ||
          m.value.published > this.last[sender].timestamp
        ) {
          this.last[sender] = {
            content: m.value.content,
            timestamp: m.value.published,
          };
          updated = true;
        }
      });

      if (updated) {
        this.saveConversationHistory();
      }
    },

    togglepinnedMess() {
      this.showPinned = !this.showPinned;
    },

    async togglePinMessage(message, session) {
      const newStatus = !message.value.pinned;

      await this.$graffiti.patch(
        { value: [{ op: "replace", path: "/pinned", value: newStatus }] },
        message,
        session
      );

      message.value.pinned = newStatus;

      const list = (this.pinnedMess[this.activeChannel] ||= []);
      if (newStatus) {
        if (!list.some((m) => m.url === message.url)) list.push(message);
      } else {
        this.pinnedMess[this.activeChannel] = list.filter(
          (m) => m.url !== message.url
        );
      }

      this.saveConversationHistory();
    },

    getPinnedCount() {
      return this.pinnedMess[this.activeChannel]?.length || 0;
    },

    getUniqueSenders(msgs) {
      let updated = false;

      const senders = [
        ...new Set(
          msgs.filter((m) => m.value.sender).map((m) => m.value.sender)
        ),
      ];

      senders.forEach((s) => {
        if (
          s !== this.$graffitiSession.value.actor &&
          !this.dmhis.includes(s)
        ) {
          this.dmhis.push(s);
          updated = true;
        }

        const lastMsg = msgs
          .filter((m) => m.value.sender === s)
          .sort((a, b) => b.value.published - a.value.published)[0];

        if (lastMsg) {
          this.last[s] = {
            content: lastMsg.value.content,
            timestamp: lastMsg.value.published,
          };
          updated = true;
        }
      });

      if (updated) {
        this.saveConversationHistory();
      }

      return senders;
    },
  },

  directives: {
    focus: {
      mounted(el) {
        el.focus();
      },
    },
  },

  mounted() {
    this.$watch(
      () => this.$graffitiSession.value,
      async (session, oldSession) => {
        if (session) {
          if (oldSession && oldSession.actor !== session.actor) {
            this.showProfilePanel = false;
            this.currentProfile = null;
            this.privateProfileToShow = null;
            this.myProfile = null;
            this.privateProfile = null;

            this.dmhis = [];
            this.last = {};
            this.pinnedMess = {};
            this.joinedGroupChats = [];
          }

          let attempts = 0;
          const maxAttempts = 3;

          const loadProfile = async () => {
            await this.loadExistingProfile(session);

            if (this.myProfile) return true;
            if (++attempts >= maxAttempts) return false;
            const delay = 500 * Math.pow(2, attempts - 1);

            await new Promise((resolve) => setTimeout(resolve, delay));
            return await loadProfile();
          };

          await loadProfile();
        } else if (oldSession) {
          this.showProfilePanel = false;
          this.currentProfile = null;
          this.privateProfileToShow = null;
          this.profileLoading = false;
          this.myProfile = null;
          this.privateProfile = null;
          this.currentUserId = null;
        }
      },
      { immediate: true }
    );

    this.$watch(
      () => this.$refs.groupChatsDiscover?.objects,
      function (groupChatObjects) {
        if (
          groupChatObjects &&
          this.joinedGroupChats &&
          this.joinedGroupChats.length > 0
        ) {
        }
      }
    );

    setInterval(() => {
      if (this.currentUserId) {
        this.saveConversationHistory();
      }
    }, 60000);
  },
})
  .use(GraffitiPlugin, {
    graffiti: new GraffitiLocal(),
  })
  .mount("#app");
