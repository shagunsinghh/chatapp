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
      userToAdd: "",
      pinnedSearchQuery: "",
      editingProfile: false,
      showGroupSettings: false,
      myMessage: "",
      sending: false,
      chatType: "group",
      activeChannel: null,
      groupChatObjects: [],
      showGroupMembers: false,
      dmChannelStubs: [],
      activeChatName: "",
      dmhis: [],
      activeSender: null,
      activeGroupObjects: [],
      last: {},
      pinnedMess: {},
      showPinnedMessages: false,
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

      if (!this.fileToUpload.type.startsWith("image/")) {
        return alert("Please select an image file");
      }

      if (this.fileToUpload.size > 5 * 1024 * 1024) {
        return alert("Image file size must be less than 5MB");
      }

      try {
        const uploadButton = document.querySelector(
          ".profile-picture-upload button"
        );
        if (uploadButton) {
          const originalText = uploadButton.textContent;
          uploadButton.textContent = "Uploading...";
          uploadButton.disabled = true;
        }

        const pictureData = {
          userId: session.actor,
          timestamp: Date.now(),
        };

        const obj = await fileToGraffitiObject(this.fileToUpload, pictureData);
        const { url } = await this.$graffiti.put(obj, session);
        this.profilePictureUrl = url;

        if (uploadButton) {
          uploadButton.textContent = "Upload Complete!";
          uploadButton.disabled = false;
          setTimeout(() => {
            uploadButton.textContent = "Upload Picture";
          }, 2000);
        }

        if (this.myProfile) {
          this.myProfile.picture = url;
        }

        this.$forceUpdate();

        console.log("Profile picture uploaded successfully:", url);
      } catch (error) {
        console.error("Error uploading profile picture:", error);
        alert("Failed to upload profile picture: " + error.message);
      }
    },
    toggleGroupSettings() {
      this.showGroupSettings = !this.showGroupSettings;

      this.$nextTick(() => {
        const toggleButton = document.querySelector(".group-settings-toggle");
        if (toggleButton) {
          if (this.showGroupSettings) {
            toggleButton.classList.add("expanded");
          } else {
            toggleButton.classList.remove("expanded");
          }
        }
      });
    },

    switchToGroupChat() {
      this.chatType = "group";
      this.activeChannel = null;
      this.activeChatName = "";
    },
    toggleGroupMembers() {
      this.showGroupMembers = !this.showGroupMembers;
    },

    getActiveMembersCount() {
      const activeGroup = this.activeGroupObjects.find(
        (o) => o.value.object.channel === this.activeChannel
      );
      if (activeGroup && activeGroup.value.object.members) {
        return activeGroup.value.object.members.length;
      }
      return 0;
    },
    switchToDirectMessages() {
      this.chatType = "direct";
      this.activeChannel = null;
      this.activeChatName = "";
      this.loadAllDirectMessages();
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
      if (!confirm("Do you want to log out?")) {
        return; // user hit Cancel → exit without logging out
      }
      this.activeChannel = null;
      this.activeChatName = "";
      this.directMessageUser = "";

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
      this.profilePictureUrl = "";

      this.dmhis = [];
      this.last = {};
      this.pinnedMess = {};
      this.joinedGroupChats = [];

      const localImpl = this.$graffiti.graffiti;
      if (localImpl.clear) {
        //localImpl.clear();
        this.profileObjects = [];
        this.renameObjects = [];

        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("chatHistory_")) {
            localStorage.removeItem(key);
          }
        });
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

    async discoverAllPossibleDMs(session) {
      const userId = session.actor;

      const knownUsers = this.profileObjects
        .map((obj) => obj.value.describes)
        .filter((id) => id !== userId && !id.endsWith("-private"));

      for (const other of knownUsers) {
        const dmChannel = [userId, other].sort().join("--");

        await new Promise((resolve) => {
          this.$graffiti.discover({
            channels: [dmChannel],
            schema: {
              properties: {
                value: {
                  required: ["content", "published"],
                  properties: {
                    content: { type: "string" },
                    published: { type: "number" },
                    sender: { type: "string" },
                  },
                },
              },
            },
            callback: (objects) => {
              if (objects && objects.length > 0) {
                const latest = objects.reduce((a, b) =>
                  a.value.published > b.value.published ? a : b
                );

                if (!this.dmhis.includes(other)) {
                  this.dmhis.push(other);
                }

                this.last[other] = {
                  content: latest.value.content,
                  timestamp: latest.value.published,
                };

                this.saveConversationHistory();
              }
              resolve();
            },
          });
        });
      }
    },
    async updateProfile(session) {
      if (!this.profileName.trim()) {
        alert("Name is required");
        return;
      }

      if (this.profileAge && isNaN(Number(this.profileAge.trim()))) {
        alert("Please enter a valid number for age.");
        return;
      }

      const updatedPublic = {
        name: this.profileName.trim(),
        pronouns: this.profilePronouns.trim() || undefined,
        describes: session.actor,
        published: Date.now(),
      };

      if (this.profilePictureUrl) {
        updatedPublic.picture = this.profilePictureUrl;
      }

      if (!this.profilePictureUrl && this.myProfile && this.myProfile.picture) {
        updatedPublic.picture = this.myProfile.picture;
      }

      console.log("Updating profile with picture:", updatedPublic.picture);

      await this.$graffiti.put(
        {
          value: updatedPublic,
          channels: [session.actor],
        },
        session
      );

      const updatedPrivate = {
        age: this.profileAge.trim() || undefined,
        location: this.profileLocation.trim() || undefined,
        describes: `${session.actor}-private`,
        published: Date.now(),
      };

      await this.$graffiti.put(
        {
          value: updatedPrivate,
          channels: [`${session.actor}-private`],
          allowed: [session.actor],
        },
        session
      );

      this.editingProfile = false;

      this.myProfile = {
        ...updatedPublic,
      };

      this.privateProfile = {
        ...updatedPrivate,
      };

      this.$forceUpdate();

      await this.loadExistingProfile(session);
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
      await this.discoverAllPossibleDMs(session);
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
    startProfileEdit() {
      this.editingProfile = !this.editingProfile;

      if (this.editingProfile) {
        if (this.myProfile) {
          this.profileName = this.myProfile.name || "";
          this.profilePronouns = this.myProfile.pronouns || "";

          if (this.privateProfile) {
            this.profileAge = this.privateProfile.age || "";
            this.profileLocation = this.privateProfile.location || "";
          } else {
            this.profileAge = "";
            this.profileLocation = "";
          }
        } else {
          this.resetProfileFormState();
        }
      } else {
        this.resetProfileFormState();
      }
    },

    async createProfile(session) {
      if (!this.profileName.trim()) {
        alert("Name is required");
        return;
      }
      if (this.profileAge && isNaN(Number(this.profileAge.trim()))) {
        alert("Please enter a valid number for age.");
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
      await this.loadExistingProfile(session);
    },
    async addUserToGroup(session) {
      if (!this.userToAdd.trim()) {
        alert("Enter a valid user ID to add");
        return;
      }

      let targetGroup = this.getActiveGroupObject();

      if (!targetGroup) {
        try {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Timeout searching for group"));
            }, 5000);

            this.$graffiti.discover({
              channels: ["designftw"],
              schema: {
                properties: {
                  value: {
                    required: ["activity", "object"],
                    properties: {
                      activity: { const: "Create" },
                      object: {
                        required: ["type", "channel"],
                        properties: {
                          type: { const: "Group Chat" },
                          channel: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
              callback: (objects) => {
                clearTimeout(timeout);
                targetGroup = objects.find(
                  (o) => o.value.object.channel === this.activeChannel
                );
                resolve();
              },
            });
          });
        } catch (error) {
          console.error("Error discovering group:", error);
        }
      }

      if (!targetGroup) {
        alert(
          "Could not find the group to update. Please try refreshing the page."
        );
        return;
      }

      const existingMembers = targetGroup.value.object.members || [];
      if (existingMembers.includes(this.userToAdd.trim())) {
        alert(`${this.userToAdd.trim()} is already a member of this group.`);
        return;
      }

      try {
        await this.$graffiti.patch(
          {
            value: [
              {
                op: "add",
                path: "/object/members/-",
                value: this.userToAdd.trim(),
              },
            ],
          },
          targetGroup,
          session
        );

        const updatedTargetGroup = JSON.parse(JSON.stringify(targetGroup));
        if (!updatedTargetGroup.value.object.members) {
          updatedTargetGroup.value.object.members = [];
        }
        updatedTargetGroup.value.object.members.push(this.userToAdd.trim());

        this.activeGroupObjects = this.activeGroupObjects.map((obj) =>
          obj.url === updatedTargetGroup.url ? updatedTargetGroup : obj
        );

        if (
          !this.activeGroupObjects.some(
            (obj) => obj.url === updatedTargetGroup.url
          )
        ) {
          this.activeGroupObjects.push(updatedTargetGroup);
        }

        alert(`Successfully added ${this.userToAdd.trim()} to the group`);
        this.userToAdd = "";
      } catch (error) {
        console.error("Error adding user to group:", error);
        alert(`Failed to add user; only owner can add users`);
      }
    },
    getActiveGroupObject() {
      if (this.activeGroupObjects && this.activeGroupObjects.length > 0) {
        return this.activeGroupObjects.find(
          (o) => o.value.object.channel === this.activeChannel
        );
      }

      if (this.$refs.groupChatsDiscover?.objects) {
        return this.$refs.groupChatsDiscover.objects.find(
          (o) => o.value.object.channel === this.activeChannel
        );
      }
      return null;
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
              members: [session.actor],
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

    async joinGroupChat(object) {
      const members = object.value.object.members || [];
      const userId = this.$graffitiSession.value?.actor;

      if (!members.includes(userId)) {
        alert("You are not a member of this group.");
        return;
      }

      this.activeChannel = object.value.object.channel;
      this.activeChatName =
        this.renameObjects.find((r) => r.value.describes === this.activeChannel)
          ?.value.name || object.value.object.name;

      this.chatType = "group";
      this.showPinned = false;

      if (
        !this.activeGroupObjects.some(
          (o) => o.value.object.channel === this.activeChannel
        )
      ) {
        this.activeGroupObjects.push(object);
        console.log("Added object to activeGroupObjects:", object);
      }

      if (!this.joinedGroupChats.includes(this.activeChannel)) {
        this.joinedGroupChats.push(this.activeChannel);
        this.saveConversationHistory();
      }

      console.log(
        "Group object check after joining:",
        this.groupChatObjects.some(
          (o) => o.value.object.channel === this.activeChannel
        )
      );
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
          recipientEl.classList.remove("bounce-once");
          void recipientEl.offsetWidth;
          recipientEl.classList.add("bounce-once");

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
        sender: session.actor,
      };

      if (this.chatType === "direct") {
        const dmChannel = [session.actor, this.activeChannel].sort().join("--");

        await this.$graffiti.put(
          {
            value: {
              type: "DirectMessageChannel",
              participants: [session.actor, this.activeChannel],
              describes: dmChannel,
              published: Date.now(),
            },
            channels: ["designftw"],
          },
          session
        );

        await this.$graffiti.put(
          {
            value: payload,
            channels: [dmChannel],
            allowed: [session.actor, this.activeChannel],
            allowedOperations: ["replace:/pinned", "replace:/liked"],
          },
          session
        );

        if (!this.dmhis.includes(this.activeChannel)) {
          this.dmhis.push(this.activeChannel);
        }
        this.last[this.activeChannel] = {
          content: this.myMessage,
          timestamp: payload.published,
        };
        this.saveConversationHistory();
      } else {
        await this.$graffiti.put(
          {
            value: payload,
            channels: [this.activeChannel],

            allowedOperations: ["replace:/pinned", "replace:/liked"],
          },
          session
        );
      }

      this.sending = false;
      this.myMessage = "";
      await this.$nextTick();
      this.$refs.messageInput?.focus();
    },
    async startDirectMessage(session) {
      const recipient = this.directMessageUser.trim();
      if (!recipient) {
        alert("Please enter a user ID");
        return;
      }

      this.activeChannel = recipient;
      this.activeChatName = this.displayName(recipient) || recipient;
      this.chatType = "direct";
      this.activeSender = null;
      this.showPinned = false;

      if (!this.dmhis.includes(recipient)) {
        this.dmhis.push(recipient);

        if (!this.last[recipient]) {
          this.last[recipient] = {
            content: "New conversation",
            timestamp: Date.now(),
          };
        }

        this.saveConversationHistory();
      }

      const dmChannel = [session.actor, recipient].sort().join("--");

      const alreadyHasMessages = await new Promise((resolve) => {
        this.$graffiti.discover({
          channels: [dmChannel],
          schema: {
            properties: {
              value: {
                required: ["content"],
                properties: {
                  content: { type: "string" },
                },
              },
            },
          },
          callback: (objects) => {
            resolve(objects.length > 0);
          },
        });
      });

      if (!alreadyHasMessages) {
        try {
          await this.$graffiti.put(
            {
              value: {
                content: `${session.actor} started a conversation.`,
                published: Date.now(),
                pinned: false,
                liked: false,
                sender: session.actor,
              },
              channels: [dmChannel],
              allowed: [session.actor, recipient],
              allowedOperations: ["replace:/pinned", "replace:/liked"],
            },
            session
          );

          this.last[recipient] = {
            content: `${session.actor} started a conversation.`,
            timestamp: Date.now(),
          };

          this.saveConversationHistory();
        } catch (err) {
          console.error("Error creating conversation:", err);
        }
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

        if (this.editingProfile) {
          this.editingProfile = false;
        }

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
    resetProfileFormState() {
      this.profileName = "";
      this.profilePronouns = "";
      this.profileAge = "";
      this.profilePictureUrl = "";
      this.profileLocation = "";
      this.fileToUpload = null;

      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach((input) => {
        input.value = "";
      });
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

      if (this.showProfilePanel) {
        this.showProfilePanel = false;
        this.currentProfile = null;
        this.privateProfileToShow = null;
        this.resetProfileFormState();
      }
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
      if (!session) return;

      let updated = false;
      const userId = session.actor;

      messages.forEach((msg) => {
        const sender = msg.value.sender || msg.actor;

        if (sender && sender !== userId) {
          if (!this.dmhis.includes(sender)) {
            console.log("Adding new conversation with:", sender);
            this.dmhis.push(sender);
            updated = true;
          }

          if (
            !this.last[sender] ||
            msg.value.published > this.last[sender].timestamp
          ) {
            this.last[sender] = {
              content: msg.value.content,
              timestamp: msg.value.published,
            };
            updated = true;
          }
        }

        if (msg.channels) {
          msg.channels.forEach((channel) => {
            if (channel.includes("--")) {
              const [a, b] = channel.split("--");

              const other = a === userId ? b : b === userId ? a : null;

              if (other && other !== userId) {
                if (!this.dmhis.includes(other)) {
                  console.log(
                    "Adding conversation partner from channel:",
                    other
                  );
                  this.dmhis.push(other);
                  updated = true;

                  if (!this.last[other]) {
                    this.last[other] = {
                      content: msg.value.content || "Conversation exists",
                      timestamp: msg.value.published || Date.now(),
                    };
                    updated = true;
                  }
                }
              }
            }
          });
        }
      });

      if (updated) {
        console.log("Conversation history updated from incoming messages");
        this.saveConversationHistory();
      }
      messages.forEach((msg) => {
        if (msg.value.pinned && this.activeChannel) {
          if (!this.pinnedMess[this.activeChannel]) {
            this.pinnedMess[this.activeChannel] = [];
          }

          if (
            !this.pinnedMess[this.activeChannel].some((m) => m.url === msg.url)
          ) {
            this.pinnedMess[this.activeChannel].push(msg);
          }
        }
      });
    },
    async loadAllDirectMessages() {
      const session = this.$graffitiSession.value;
      if (!session) return;
      const userId = session.actor;

      this.loadConversationHistory();

      this.$graffiti.discover({
        channels: ["designftw"],
        schema: {
          properties: {
            value: {
              required: ["type", "participants", "describes"],
              properties: {
                type: { const: "DirectMessageChannel" },
                participants: { type: "array" },
                describes: { type: "string" },
              },
            },
          },
        },
        callback: (dmStubs) => {
          const stubs = dmStubs.filter((o) =>
            o.value.participants.includes(userId)
          );

          stubs.forEach((stub, idx) => {
            const dmChannel = stub.value.describes;
            const [a, b] = dmChannel.split("--");
            const other = a === userId ? b : a;

            if (!this.dmhis.includes(other)) {
              this.dmhis.push(other);
            }

            this.$graffiti.discover({
              channels: [dmChannel],
              schema: {
                properties: {
                  value: {
                    required: ["content", "published"],
                    properties: {
                      content: { type: "string" },
                      published: { type: "number" },
                    },
                  },
                },
              },
              callback: (msgs) => {
                if (!msgs.length) return;
                const latest = msgs.reduce((a, b) =>
                  a.value.published > b.value.published ? a : b
                );
                this.last[other] = {
                  content: latest.value.content,
                  timestamp: latest.value.published,
                };
                this.saveConversationHistory();

                if (idx === 0) {
                  this.chatType = "direct";
                  this.activeChannel = other;
                  this.activeChatName = this.displayName(other) || other;
                }
              },
            });
          });

          if (stubs.length) {
            this.chatType = "direct";
          }
        },
      });
    },
    togglePinnedDisplay() {
      this.showPinnedMessages = !this.showPinnedMessages;
    },

    async togglePinMessage(message, session) {
      const isMine = message.actor === session.actor;
      const newStatus = !message.value.pinned;

      if (isMine) {
        try {
          await this.$graffiti.patch(
            { value: [{ op: "replace", path: "/pinned", value: newStatus }] },
            message,
            session
          );
          message.value.pinned = newStatus;
        } catch (err) {
          console.error("Error toggling pin:", err);
          alert("Unable to pin this message globally.");
          return;
        }
      } else {
        message.value.pinned = newStatus;
      }

      const channel = this.activeChannel;
      if (!this.pinnedMess[channel]) {
        this.pinnedMess[channel] = [];
      }
      if (newStatus) {
        if (!this.pinnedMess[channel].some((m) => m.url === message.url)) {
          this.pinnedMess[channel].push(message);
        }
      } else {
        this.pinnedMess[channel] = this.pinnedMess[channel].filter(
          (m) => m.url !== message.url
        );
      }

      this.saveConversationHistory();
      console.log(
        isMine
          ? "Global pin toggled"
          : "Local pin toggled for someone else's message"
      );
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

          this.loadAllDirectMessages();
        } else if (oldSession) {
          if (this.dmDiscoveryTimeout) {
            clearTimeout(this.dmDiscoveryTimeout);
            this.dmDiscoveryTimeout = null;
          }

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
      function (newObjects) {
        if (newObjects) {
          this.groupChatObjects = newObjects;
        }
      }
    );
    this.$watch(
      () => this.chatType,
      (newChatType) => {
        if (newChatType === "direct" && this.$graffitiSession.value) {
          this.loadAllDirectMessages();
        }
      }
    );

    if (this.$graffitiSession.value) {
      this.loadAllDirectMessages();
    }

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
