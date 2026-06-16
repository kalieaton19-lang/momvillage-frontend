"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import PostContentWithPreview from "../components/PostContentWithPreview";
import ReportModal, { ReportType, ReportReason } from "../components/ReportModal";
import { supabase } from "../../lib/supabase";
import { fetchPosts, createPost, fetchPostInteractions, togglePostLike, addPostComment, sharePost, PostCommentRow } from "../../lib/posts";
import { Post, PostType, PostScope, PostVisibility } from "../../types/post";
import type { JSX } from "react";

type GroupRow = {
  id: string;
  name: string;
  bio?: string | null;
  visibility: "open" | "by_permission";
  creator_user_id: string;
  created_at: string;
};

// LocationField component for post modal (must be outside HomePage)
function LocationField({ profileLocation, formLocation, setForm }: { profileLocation: string, formLocation: string, setForm: any }) {
  const [custom, setCustom] = React.useState(false);
  const isDefault = !custom && (formLocation === profileLocation || !formLocation);

  React.useEffect(() => {
    // If user switches back to default, reset location to profile
    if (!custom) setForm((f: any) => ({ ...f, location: profileLocation }));
  }, [custom, profileLocation, setForm]);

  return (
    <div>
      <label htmlFor="post-location" className="block text-sm font-medium text-pink-700 dark:text-pink-300 mb-1">Location</label>
      {isDefault ? (
        <div className="flex items-center gap-2">
          <span className="px-3 py-2 rounded-lg bg-pink-50 border border-pink-200 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 font-semibold">
            {profileLocation || 'No location set in profile'}
          </span>
          <button
            type="button"
            className="ml-2 text-pink-600 dark:text-pink-300 hover:underline text-sm font-medium"
            onClick={() => setCustom(true)}
          >
            Other location
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            id="post-location"
            name="location"
            className="w-full rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400 transition placeholder-pink-300 dark:placeholder-zinc-500"
            placeholder="Enter a different location"
            value={formLocation}
            onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))}
          />
          <button
            type="button"
            className="ml-2 text-pink-600 dark:text-pink-300 hover:underline text-sm font-medium"
            onClick={() => setCustom(false)}
          >
            Use profile location
          </button>
        </div>
      )}
      <div className="text-xs text-pink-400 dark:text-pink-300 mt-1">
        Posting location: <span className="font-semibold text-pink-600 dark:text-pink-200">{formLocation || profileLocation || 'Not set'}</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedType, setFeedType] = useState<'local' | 'village' | 'groups'>('local');
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null); // For groups logic
  const [groupMode, setGroupMode] = useState<"actions" | "search" | "create">("actions");
  const [groupSearch, setGroupSearch] = useState("");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [myGroups, setMyGroups] = useState<GroupRow[]>([]);
  const [myGroupsLoading, setMyGroupsLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupBio, setNewGroupBio] = useState("");
  const [newGroupVisibility, setNewGroupVisibility] = useState<"open" | "by_permission">("open");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createGroupMessage, setCreateGroupMessage] = useState("");
  const [groupAccessMessage, setGroupAccessMessage] = useState("");
  const [requestingAccessByGroup, setRequestingAccessByGroup] = useState<Record<string, boolean>>({});
  const [requestedAccessByGroup, setRequestedAccessByGroup] = useState<Record<string, boolean>>({});
  const [membershipStatusByGroup, setMembershipStatusByGroup] = useState<Record<string, "pending" | "approved">>({});
  const [groupPosts, setGroupPosts] = useState<Post[]>([]);
  const [groupPostsLoading, setGroupPostsLoading] = useState(false);
  const [showGroupPostForm, setShowGroupPostForm] = useState(false);
  const [groupPostTitle, setGroupPostTitle] = useState("");
  const [groupPostContent, setGroupPostContent] = useState("");
  const [creatingGroupPost, setCreatingGroupPost] = useState(false);
  const [groupPostMessage, setGroupPostMessage] = useState("");
  const [authorPhotoById, setAuthorPhotoById] = useState<Record<string, string>>({});
  const [authorNameById, setAuthorNameById] = useState<Record<string, string>>({});
  const [groupNameById, setGroupNameById] = useState<Record<string, string>>({});
  const [likesCountByPost, setLikesCountByPost] = useState<Record<string, number>>({});
  const [likedByMeByPost, setLikedByMeByPost] = useState<Record<string, boolean>>({});
  const [sharesCountByPost, setSharesCountByPost] = useState<Record<string, number>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostCommentRow[]>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [interactionBusyByPost, setInteractionBusyByPost] = useState<Record<string, boolean>>({});
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [expandedCommentsByPost, setExpandedCommentsByPost] = useState<Record<string, boolean>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalType, setReportModalType] = useState<ReportType>("post");
  const [reportModalTargetId, setReportModalTargetId] = useState<string>("");
  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'general' as PostType,
    visibility: 'public' as PostVisibility,
    location: profile?.city ? `${profile.city}${profile.state ? ', ' + profile.state : ''}` : '',
  });

  function getProfileHref(authorUserId?: string | null) {
    if (!authorUserId) return null;
    return authorUserId === user?.id ? '/profile' : `/profile/${authorUserId}`;
  }

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) loadPosts();
  }, [user, feedType]);

  useEffect(() => {
    if (!user || feedType !== "groups" || groupMode !== "search") return;
    const handler = setTimeout(() => {
      void loadGroups(groupSearch);
    }, 250);
    return () => clearTimeout(handler);
  }, [user, feedType, groupMode, groupSearch]);

  useEffect(() => {
    if (!user || feedType !== "groups") return;
    void loadMyGroups();
  }, [user, feedType]);

  useEffect(() => {
    if (!selectedGroupId || feedType !== "groups") return;
    void loadGroupPosts(selectedGroupId);
  }, [selectedGroupId, feedType]);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.user_metadata) {
        setProfile(currentUser.user_metadata);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts() {
    setLoading(true);
    try {
      let nextPosts: Post[] = [];
      if (feedType === 'village' && user) {
        // Fetch village member user IDs for the current user
        const { data: memberRows } = await supabase
          .from('village_members')
          .select('user_id, member_id')
          .or(`user_id.eq.${user.id},member_id.eq.${user.id}`);

        // Collect all user IDs in the village (excluding self)
        const villageUserIds: string[] = [];
        (memberRows || []).forEach((row: any) => {
          if (row.user_id !== user.id) villageUserIds.push(row.user_id);
          if (row.member_id !== user.id) villageUserIds.push(row.member_id);
        });
        // Always include self
        villageUserIds.push(user.id);
        const uniqueVillageUserIds = [...new Set(villageUserIds)];

        // Fetch village-scoped posts + public posts from village members
        const [villagePosts, publicVillagePosts] = await Promise.all([
          fetchPosts({ scope: 'village' }),
          uniqueVillageUserIds.length > 0
            ? supabase
                .from('posts')
                .select('*')
                .eq('scope', 'public')
                .in('author_user_id', uniqueVillageUserIds)
                .order('created_at', { ascending: false })
                .then(({ data }) => data || [])
            : Promise.resolve([]),
        ]);

        // Merge, deduplicate by id, sort by created_at desc
        const merged = [...villagePosts, ...publicVillagePosts];
        const seen = new Set<string>();
        const deduped = merged.filter((p: any) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        deduped.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        nextPosts = deduped as Post[];
      } else {
        // Local feed: all public posts
        nextPosts = await fetchPosts({ scope: 'public' });
      }

      // Enforce group post visibility on local/village feeds:
      // show only if group is open OR current user is creator/member.
      try {
        const groupIds = [...new Set(nextPosts.map((post) => post.group_id).filter((id): id is string => !!id))];
        if (groupIds.length === 0) {
          setGroupNameById({});
          setPosts(nextPosts);
        } else {
          const [{ data: groupsData }, { data: membershipRows }] = await Promise.all([
            supabase
              .from("groups")
              .select("id,name,visibility,creator_user_id")
              .in("id", groupIds),
            supabase
              .from("group_members")
              .select("group_id,status")
              .eq("user_id", user.id)
              .in("group_id", groupIds),
          ]);

          const groupById: Record<string, { name: string; visibility: "open" | "by_permission"; creator_user_id: string }> = {};
          (groupsData || []).forEach((group: any) => {
            if (group?.id) {
              groupById[group.id] = {
                name: group.name || "Group",
                visibility: (group.visibility as "open" | "by_permission") || "by_permission",
                creator_user_id: group.creator_user_id || "",
              };
            }
          });

          const approvedMemberGroupIds = new Set(
            (membershipRows || [])
              .filter((row: any) => row?.status === "approved" && row?.group_id)
              .map((row: any) => row.group_id as string)
          );

          const visiblePosts = nextPosts.filter((post) => {
            if (!post.group_id) return true;
            const groupMeta = groupById[post.group_id];
            if (!groupMeta) return false;
            if (groupMeta.visibility === "open") return true;
            if (groupMeta.creator_user_id === user.id) return true;
            return approvedMemberGroupIds.has(post.group_id);
          });

          const groupMap: Record<string, string> = {};
          Object.entries(groupById).forEach(([id, meta]) => {
            groupMap[id] = meta.name;
          });

          nextPosts = visiblePosts;
          setGroupNameById(groupMap);
          setPosts(nextPosts);
        }
      } catch (e) {
        setGroupNameById({});
        setPosts(nextPosts.filter((post) => !post.group_id));
      }

      // Hydrate author profile photos for post cards (non-blocking)
      try {
        const authorIds = [...new Set(nextPosts.map((post) => post.author_user_id).filter(Boolean))];
        if (authorIds.length === 0) {
          setAuthorPhotoById({});
        } else {
          const { data: authorProfiles } = await supabase
            .from('user_public_profiles')
            .select('id, profile_photo_url, full_name')
            .in('id', authorIds);

          const authorPhotoMap: Record<string, string> = {};
          const authorNameMap: Record<string, string> = {};
          (authorProfiles || []).forEach((profile: any) => {
            if (profile?.id && profile?.profile_photo_url) {
              authorPhotoMap[profile.id] = profile.profile_photo_url;
            }
            if (profile?.id && profile?.full_name) {
              authorNameMap[profile.id] = profile.full_name;
            }
          });
          setAuthorPhotoById(authorPhotoMap);
          setAuthorNameById(authorNameMap);
        }
      } catch (e) {
        setAuthorPhotoById({});
      }

      // Fetch interactions (non-blocking so posts still render even if migration isn't applied yet)
      try {
        const postIds = nextPosts.map((post) => post.id);
        const interactions = await fetchPostInteractions(postIds, user?.id);
        setLikesCountByPost(interactions.likesCountByPost);
        setLikedByMeByPost(interactions.likedByMeByPost);
        setSharesCountByPost(interactions.sharesCountByPost);
        setCommentsByPost(interactions.commentsByPost);

        const allComments = Object.values(interactions.commentsByPost).flat() as PostCommentRow[];
        const knownIds = new Set([...nextPosts.map((post) => post.author_user_id), user?.id].filter(Boolean) as string[]);
        const unknownCommentAuthorIds = [...new Set(allComments.map((comment) => comment.author_user_id).filter((id): id is string => !!id && !knownIds.has(id)))];
        if (unknownCommentAuthorIds.length > 0) {
          const { data: commentAuthorProfiles } = await supabase
            .from('user_public_profiles')
            .select('id, full_name, profile_photo_url')
            .in('id', unknownCommentAuthorIds);
          if (commentAuthorProfiles) {
            setAuthorNameById((prev) => {
              const updated = { ...prev };
              commentAuthorProfiles.forEach((p: any) => {
                if (p?.id && p?.full_name) updated[p.id] = p.full_name;
              });
              return updated;
            });
            setAuthorPhotoById((prev) => {
              const updated = { ...prev };
              commentAuthorProfiles.forEach((p: any) => {
                if (p?.id && p?.profile_photo_url) updated[p.id] = p.profile_photo_url;
              });
              return updated;
            });
          }
        }
      } catch (e) {
        setLikesCountByPost({});
        setLikedByMeByPost({});
        setSharesCountByPost({});
        setCommentsByPost({});
      }
    } catch (e) {
      setPosts([]);
      setGroupNameById({});
      setAuthorPhotoById({});
      setLikesCountByPost({});
      setLikedByMeByPost({});
      setSharesCountByPost({});
      setCommentsByPost({});
    } finally {
      setLoading(false);
    }
  }

  async function loadGroups(searchText: string) {
    setGroupsLoading(true);
    setGroupsError("");
    try {
      const trimmed = searchText.trim();
      let query = supabase
        .from("groups")
        .select("id,name,bio,visibility,creator_user_id,created_at")
        .order("created_at", { ascending: false })
        .limit(30);

      if (trimmed) {
        query = query.ilike("name", `%${trimmed}%`);
      }

      const initialResult = await query;
      let data = (initialResult.data || null) as Array<Partial<GroupRow>> | null;
      let error = initialResult.error;

      const missingBioColumn =
        error?.code === "42703" ||
        String(error?.message || "").toLowerCase().includes("bio");

      if (missingBioColumn) {
        let fallbackQuery = supabase
          .from("groups")
          .select("id,name,visibility,creator_user_id,created_at")
          .order("created_at", { ascending: false })
          .limit(30);

        if (trimmed) {
          fallbackQuery = fallbackQuery.ilike("name", `%${trimmed}%`);
        }

        const fallbackResult = await fallbackQuery;
        data = (fallbackResult.data || null) as Array<Partial<GroupRow>> | null;
        error = fallbackResult.error;
      }

      if (error) throw error;
      const normalizedGroups = ((data || []) as GroupRow[]).map((group) => ({ ...group, bio: group.bio || null }));
      setGroups(normalizedGroups);

      if (user?.id && normalizedGroups.length > 0) {
        const groupIds = normalizedGroups.map((group) => group.id);
        const { data: membershipRows } = await supabase
          .from("group_members")
          .select("group_id,status")
          .eq("user_id", user.id)
          .in("group_id", groupIds);

        const membershipMap: Record<string, "pending" | "approved"> = {};
        (membershipRows || []).forEach((row: { group_id: string; status: "pending" | "approved" }) => {
          if (row.group_id && (row.status === "pending" || row.status === "approved")) {
            membershipMap[row.group_id] = row.status;
          }
        });
        setMembershipStatusByGroup(membershipMap);
      }
      if ((data || []).length === 0) {
        setGroupsError(trimmed ? "No groups found." : "No groups yet.");
      }
    } catch (error) {
      console.error("Failed to load groups", error);
      setGroups([]);
      setGroupsError("Could not load groups. Please verify your groups table/policies in Supabase.");
    } finally {
      setGroupsLoading(false);
    }
  }

  async function loadMyGroups() {
    if (!user?.id) return;
    setMyGroupsLoading(true);
    try {
      let memberships: Array<{ group_id: string; status: "pending" | "approved" }> = [];
      const membershipResult = await supabase
        .from("group_members")
        .select("group_id,status")
        .eq("user_id", user.id)
        .eq("status", "approved");

      if (!membershipResult.error) {
        memberships = (membershipResult.data || []) as Array<{ group_id: string; status: "pending" | "approved" }>;
      }

      const membershipGroupIds = (memberships || []).map((membership: { group_id: string }) => membership.group_id).filter(Boolean);

      const createdResult = await supabase
        .from("groups")
        .select("id,name,bio,visibility,creator_user_id,created_at")
        .eq("creator_user_id", user.id)
        .order("created_at", { ascending: false });
      let createdGroups = createdResult.data as GroupRow[] | null;
      if (createdResult.error) {
        const missingBioColumn =
          createdResult.error.code === "42703" ||
          String(createdResult.error.message || "").toLowerCase().includes("bio");
        if (missingBioColumn) {
          const fallbackCreated = await supabase
            .from("groups")
            .select("id,name,visibility,creator_user_id,created_at")
            .eq("creator_user_id", user.id)
            .order("created_at", { ascending: false });
          createdGroups = (fallbackCreated.data || []) as GroupRow[];
        } else {
          throw createdResult.error;
        }
      }

      let memberGroups: GroupRow[] = [];
      if (membershipGroupIds.length > 0) {
        const memberGroupsResult = await supabase
          .from("groups")
          .select("id,name,bio,visibility,creator_user_id,created_at")
          .in("id", membershipGroupIds)
          .order("created_at", { ascending: false });

        if (memberGroupsResult.error) {
          const missingBioColumn =
            memberGroupsResult.error.code === "42703" ||
            String(memberGroupsResult.error.message || "").toLowerCase().includes("bio");
          if (missingBioColumn) {
            const fallbackMemberGroups = await supabase
              .from("groups")
              .select("id,name,visibility,creator_user_id,created_at")
              .in("id", membershipGroupIds)
              .order("created_at", { ascending: false });
            memberGroups = (fallbackMemberGroups.data || []) as GroupRow[];
          } else {
            throw memberGroupsResult.error;
          }
        } else {
          memberGroups = (memberGroupsResult.data || []) as GroupRow[];
        }
      }

      const merged = [...((createdGroups || []) as GroupRow[]), ...memberGroups];
      const dedupedById = new Map<string, GroupRow>();
      merged.forEach((group) => {
        if (group?.id) dedupedById.set(group.id, { ...group, bio: group.bio || null });
      });
      setMyGroups(Array.from(dedupedById.values()));
    } catch (error) {
      console.error("Failed to load user groups", error);
      setMyGroups([]);
    } finally {
      setMyGroupsLoading(false);
    }
  }

  async function handleCreateGroup() {
    if (!user) return;
    const trimmedName = newGroupName.trim();
    if (!trimmedName) {
      setCreateGroupMessage("Group name is required.");
      return;
    }

    setCreatingGroup(true);
    setCreateGroupMessage("");
    try {
      const initialInsertResult = await supabase
        .from("groups")
        .insert({
          name: trimmedName,
          bio: newGroupBio.trim() || null,
          visibility: newGroupVisibility,
          creator_user_id: user.id,
        })
        .select("id,name,bio,visibility,creator_user_id,created_at")
        .single();
      let data = (initialInsertResult.data || null) as Partial<GroupRow> | null;
      let error = initialInsertResult.error;

      const missingBioColumn =
        error?.code === "42703" ||
        String(error?.message || "").toLowerCase().includes("bio");

      if (missingBioColumn) {
        const fallback = await supabase
          .from("groups")
          .insert({
            name: trimmedName,
            visibility: newGroupVisibility,
            creator_user_id: user.id,
          })
          .select("id,name,visibility,creator_user_id,created_at")
          .single();
        data = (fallback.data || null) as Partial<GroupRow> | null;
        error = fallback.error;
      }

      if (error) throw error;

      setCreateGroupMessage("Group created successfully!");
      setNewGroupName("");
      setNewGroupBio("");
      setNewGroupVisibility("open");
      setGroupMode("search");
      await loadGroups("");
      await loadMyGroups();
      if (data?.id) router.push(`/groups/${data.id}`);
    } catch (error: any) {
      const message = error?.message?.includes("duplicate")
        ? "A group with that name already exists."
        : "Could not create group. Please verify groups table/policies in Supabase.";
      setCreateGroupMessage(message);
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleRequestAccess(groupId: string) {
    if (!user?.id) return;
    setRequestingAccessByGroup((prev) => ({ ...prev, [groupId]: true }));
    setGroupAccessMessage("");
    try {
      const { error } = await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: user.id,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          setRequestedAccessByGroup((prev) => ({ ...prev, [groupId]: true }));
          setGroupAccessMessage("Access request already submitted.");
          return;
        }
        throw error;
      }

      setRequestedAccessByGroup((prev) => ({ ...prev, [groupId]: true }));
      setMembershipStatusByGroup((prev) => ({ ...prev, [groupId]: "pending" }));
      setGroupAccessMessage("Access request sent.");
    } catch (error) {
      console.error("Failed to request group access", error);
      setGroupAccessMessage("Could not request access.");
    } finally {
      setRequestingAccessByGroup((prev) => ({ ...prev, [groupId]: false }));
    }
  }

  function isMissingGroupIdColumnError(error: any) {
    return (
      error?.code === "42703" ||
      String(error?.message || "").toLowerCase().includes("group_id")
    );
  }

  async function loadGroupPosts(groupId: string) {
    setGroupPostsLoading(true);
    setGroupPostMessage("");
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGroupPosts((data || []) as Post[]);
    } catch (error) {
      console.error("Failed to load group posts", error);
      setGroupPosts([]);
      if (isMissingGroupIdColumnError(error)) {
        setGroupPostMessage("Group posts require migration 016 (posts.group_id). Please run it in Supabase.");
      } else {
        setGroupPostMessage("Could not load posts for this group.");
      }
    } finally {
      setGroupPostsLoading(false);
    }
  }

  async function handleCreateGroupPost() {
    if (!user?.id || !selectedGroupId) return;
    const trimmedTitle = groupPostTitle.trim();
    const trimmedContent = groupPostContent.trim();
    if (!trimmedTitle || !trimmedContent) {
      setGroupPostMessage("Title and content are required.");
      return;
    }

    setCreatingGroupPost(true);
    setGroupPostMessage("");
    try {
      const { error } = await supabase.from("posts").insert({
        author_user_id: user.id,
        author_name: profile?.full_name || user.email || "Mom",
        type: "general",
        scope: "public",
        visibility: "public",
        title: trimmedTitle,
        content: trimmedContent,
        location: profile?.city ? `${profile.city}${profile.state ? `, ${profile.state}` : ""}` : null,
        group_id: selectedGroupId,
      });

      if (error) throw error;

      setGroupPostTitle("");
      setGroupPostContent("");
      setShowGroupPostForm(false);
      setGroupPostMessage("Post created.");
      await loadGroupPosts(selectedGroupId);
    } catch (error) {
      console.error("Failed to create group post", error);
      if (isMissingGroupIdColumnError(error)) {
        setGroupPostMessage("Could not create group post: run migration 016 to add posts.group_id.");
      } else {
        setGroupPostMessage("Could not create group post.");
      }
    } finally {
      setCreatingGroupPost(false);
    }
  }

  async function handleToggleLike(postId: string) {
    if (!user?.id) return;
    const currentlyLiked = !!likedByMeByPost[postId];
    setInteractionBusyByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      await togglePostLike(postId, user.id, currentlyLiked);
      setLikedByMeByPost((prev) => ({ ...prev, [postId]: !currentlyLiked }));
      setLikesCountByPost((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] || 0) + (currentlyLiked ? -1 : 1)),
      }));
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      const maybeDetails = e?.details ? `\n${e.details}` : "";
      const maybeHint = e?.hint ? `\nHint: ${e.hint}` : "";
      const maybeMissingTable = String(e?.message || "").includes("post_likes") || String(e?.message || "").includes("does not exist")
        ? "\nInteraction tables may be missing. Run migration 009 in Supabase SQL Editor."
        : "";
      const maybePolicyHint = e?.code === "42501" || String(e?.message || "").toLowerCase().includes("policy")
        ? "\nLike visibility/persistence may be blocked by stale RLS policies. Run migration 015 in Supabase SQL Editor."
        : "";
      alert(`Like failed${maybeCode}: ${e?.message || "Unknown error"}${maybeDetails}${maybeHint}${maybeMissingTable}${maybePolicyHint}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function handleAddComment(postId: string) {
    if (!user?.id) return;
    const targetPost = posts.find((post) => post.id === postId);
    if (targetPost?.comments_disabled) {
      alert("Comments are disabled for this post.");
      return;
    }
    const draft = (commentDraftByPost[postId] || "").trim();
    if (!draft) return;
    setInteractionBusyByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      await addPostComment(postId, user.id, draft);
      const newComment: PostCommentRow = {
        id: `${Date.now()}`,
        post_id: postId,
        author_user_id: user.id,
        body: draft,
        created_at: new Date().toISOString(),
      };
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      setCommentDraftByPost((prev) => ({ ...prev, [postId]: "" }));
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      const maybeDetails = e?.details ? `\n${e.details}` : "";
      const maybeHint = e?.hint ? `\nHint: ${e.hint}` : "";
      const maybeMissingTable = String(e?.message || "").includes("post_comments") || String(e?.message || "").includes("does not exist")
        ? "\nInteraction tables may be missing. Run migration 009 in Supabase SQL Editor."
        : "";
      const maybeUniqueCommentHint = (e?.code === "23505") && String(e?.message || "").includes("post_comments_one_author_per_post_idx")
        ? "\nComments are still limited in your live DB. Run migration 012 in Supabase SQL Editor."
        : "";
      alert(`Comment failed${maybeCode}: ${e?.message || "Unknown error"}${maybeDetails}${maybeHint}${maybeMissingTable}${maybeUniqueCommentHint}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  function handleStartEditComment(comment: PostCommentRow) {
    setEditingCommentId(comment.id);
    setEditingCommentDraft(comment.body);
    setOpenCommentMenuId(null);
  }

  function handleCancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentDraft("");
  }

  async function handleSaveCommentEdit(post: Post, comment: PostCommentRow) {
    if (!user?.id) return;
    const trimmed = editingCommentDraft.trim();
    if (!trimmed) {
      alert("Comment can't be empty.");
      return;
    }
    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      const { error } = await supabase
        .from("post_comments")
        .update({ body: trimmed })
        .eq("id", comment.id)
        .eq("author_user_id", user.id);
      if (error) throw error;

      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || []).map((entry) =>
          entry.id === comment.id ? { ...entry, body: trimmed } : entry
        ),
      }));
      handleCancelEditComment();
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      const maybeDetails = e?.details ? `\n${e.details}` : "";
      const maybeHint = e?.hint ? `\nHint: ${e.hint}` : "";
      const maybePolicyHint = e?.code === "42501" || String(e?.message || "").toLowerCase().includes("policy")
        ? "\nComment editing may be blocked by stale RLS policies. Run migration 013 in Supabase SQL Editor."
        : "";
      alert(`Edit comment failed${maybeCode}: ${e?.message || "Unknown error"}${maybeDetails}${maybeHint}${maybePolicyHint}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleDeleteComment(post: Post, comment: PostCommentRow) {
    if (!user?.id) return;
    const canDelete = user.id === comment.author_user_id || user.id === post.author_user_id;
    if (!canDelete) return;

    const confirmed = window.confirm("Delete this comment? This cannot be undone.");
    if (!confirmed) return;

    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", comment.id);
      if (error) throw error;

      if (editingCommentId === comment.id) {
        handleCancelEditComment();
      }
      setOpenCommentMenuId(null);

      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || []).filter((entry) => entry.id !== comment.id),
      }));
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      const maybeDetails = e?.details ? `\n${e.details}` : "";
      const maybeHint = e?.hint ? `\nHint: ${e.hint}` : "";
      alert(`Delete comment failed${maybeCode}: ${e?.message || "Unknown error"}${maybeDetails}${maybeHint}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleDeletePost(postId: string) {
    if (!user?.id) return;
    const confirmed = window.confirm("Delete this post? This cannot be undone.");
    if (!confirmed) return;
    setInteractionBusyByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      setCommentsByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setLikesCountByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setSharesCountByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setOpenPostMenuId(null);
    } catch (e: any) {
      alert("Delete failed: " + (e?.message || "Unknown error"));
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function handleToggleCommentsDisabled(post: Post) {
    if (!user?.id) return;
    const nextValue = !post.comments_disabled;
    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      const { data: updatedRows, error } = await supabase
        .from("posts")
        .update({ comments_disabled: nextValue })
        .eq("id", post.id)
        .eq("author_user_id", user.id)
        .select("id");
      if (error) throw error;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("No rows updated. You may not be the owner of this post or RLS blocked the update.");
      }
      setPosts((prev) => prev.map((entry) => (entry.id === post.id ? { ...entry, comments_disabled: nextValue } : entry)));
      setOpenPostMenuId(null);
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      const maybeDetails = e?.details ? `\n${e.details}` : "";
      const maybeHint = e?.hint ? `\nHint: ${e.hint}` : "";
      const message = e?.message || "Unknown error";
      const missingColumnHint = message.includes("comments_disabled") || message.includes("column")
        ? "\n`comments_disabled` may not exist in your live DB yet. Run migration 010 in Supabase SQL Editor."
        : "";
      alert(`Update failed${maybeCode}: ${message}${maybeDetails}${maybeHint}${missingColumnHint}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleShare(post: Post) {
    if (!user?.id) return;
    if (post.visibility !== "public") {
      alert("Only public posts can be shared.");
      return;
    }
    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      await sharePost(post.id, user.id);
      setSharesCountByPost((prev) => ({ ...prev, [post.id]: (prev[post.id] || 0) + 1 }));

      const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/home#post-${post.id}` : "";
      if (typeof navigator !== "undefined" && (navigator as any).share && shareUrl) {
        await (navigator as any).share({ title: post.title, text: post.content, url: shareUrl });
      } else if (shareUrl && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        alert("Post link copied to clipboard.");
      }
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      const maybeDetails = e?.details ? `\n${e.details}` : "";
      const maybeHint = e?.hint ? `\nHint: ${e.hint}` : "";
      const maybeMissingTable = String(e?.message || "").includes("post_shares") || String(e?.message || "").includes("does not exist")
        ? "\nInteraction tables may be missing. Run migration 009 in Supabase SQL Editor."
        : "";
      alert(`Share failed${maybeCode}: ${e?.message || "Unknown error"}${maybeDetails}${maybeHint}${maybeMissingTable}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleReport(reason: ReportReason, details?: string) {
    try {
      const endpoint = reportModalType === "post" 
        ? "/api/reports/post"
        : reportModalType === "comment"
        ? "/api/reports/comment"
        : "/api/reports/account";

      const body = reportModalType === "post"
        ? { postId: reportModalTargetId, reason, details }
        : reportModalType === "comment"
        ? { commentId: reportModalTargetId, reason, details }
        : { accountUserId: reportModalTargetId, reason, details };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit report");
      }

      alert("Report submitted. Thank you for helping keep our community safe.");
      setReportModalOpen(false);
    } catch (error: any) {
      throw error;
    }
  }

  async function handleCreatePost(e: React.FormEvent) {
      // Log session before RPC for debugging
      const { data: { session: debugSession } } = await supabase.auth.getSession();
      console.log("Session before RPC:", debugSession);
    e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (creating) {
      // Prevent double submission
      return;
    }
    setCreating(true);
    // Session/auth gate before post creation
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Session error:", sessionError);
      alert("Auth error. Please reload and try again.");
      setCreating(false);
      return;
    }
    if (!session?.user) {
      alert("You must be logged in to create a post.");
      setCreating(false);
      return;
    }
    console.log("Authenticated user id:", session.user.id);
    try {
      let village_member_id: string | null = null;
      if (form.visibility === "village") {
        const { data, error } = await supabase
          .from("village_members")
          .select("id")
          .or(`user_id.eq.${user.id},member_id.eq.${user.id}`)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        village_member_id = data?.id ?? null;
        if (!village_member_id) {
          alert("Join a village first to post to your village.");
          setCreating(false);
          return;
        }
      }
      // Log scope and village_member_id before RPC
      // Always use 'public' for non-village posts, never 'local', and normalize
      let scope = form.visibility === "village" ? "village" : "public";
      const normalizedScope = scope.trim().toLowerCase();

      // Upload photo if selected
      let photo_url: string | undefined = undefined;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const fileName = `${user.id}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('post-photos')
          .upload(fileName, photoFile, { upsert: true });
        if (uploadError) {
          alert('Photo upload failed: ' + uploadError.message);
          setCreating(false);
          return;
        }
        const { data: urlData } = supabase.storage.from('post-photos').getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }

      const { data, error } = await createPost({
        ...form,
        author_user_id: user.id,
        author_name: profile?.full_name || "Anonymous",
        scope: normalizedScope as PostScope,
        village_member_id: normalizedScope === "village" ? village_member_id ?? undefined : undefined,
        photo_url,
      });
      // Persistent debug logs for backend feedback
      console.log("RPC error:", error);
      console.log("RPC data:", data);
      console.log("typeof data:", typeof data);
      console.log("isArray:", Array.isArray(data));
      if (error) {
        alert("Post error: " + JSON.stringify(error));
        console.error("createPost RPC error:", error);
      } else {
        console.log("createPost RPC result:", data);
        if (data && data.id) {
          const { data: row, error: selectError } = await supabase
            .from("posts")
            .select("*")
            .eq("id", data.id)
            .maybeSingle();
          if (selectError) alert("Select error: " + JSON.stringify(selectError));
          console.log("select error:", selectError);
          console.log("select row:", row);
        }
        setForm({
          title: "",
          content: "",
          type: "general",
          visibility: "public",
          location: profile?.city ? `${profile.city}${profile.state ? ", " + profile.state : ""}` : "",
        });
        setPhotoFile(null);
        setPhotoPreview(null);
        if (photoInputRef.current) photoInputRef.current.value = '';
        await loadPosts();
        // Only navigate after post is created and loaded
        // router.push('/home'); // TEMP: Commented out to confirm logs appear before navigation
      }
    } catch (e) {
      console.error("Create post error:", e);
      alert("Failed to create post");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 flex flex-col">
      <div className="max-w-2xl w-full mx-auto p-4 flex-1 flex flex-col pt-8 sm:pt-4">
        <header className="mb-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            {profile?.profile_photo_url ? (
              <div className="w-20 h-20 min-w-[5rem] min-h-[5rem] aspect-square rounded-full overflow-hidden border-2 border-pink-400 shadow flex items-center justify-center">
                <img
                  src={profile.profile_photo_url}
                  alt={profile?.full_name || "Profile"}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            ) : (
              <div className="w-20 h-20 min-w-[5rem] min-h-[5rem] aspect-square rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-3xl font-semibold border-2 border-pink-400 shadow">
                {profile?.full_name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <Link href="/profile">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 hover:underline cursor-pointer">
                  {profile?.full_name || 'Mom'}
                </h1>
              </Link>
            </div>
          </div>
          {/* Messages button beside profile image */}
          <div className="flex items-center mt-2 sm:mt-0">
            <NavButton href="/messages" icon="chat" label="" className="w-12 h-12 ml-2" />
          </div>
        </header>
        {/* Post creation modal */}
        {showCreateModal && (
          <>
            {/* Backdrop overlay disables all interaction with homepage buttons */}
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm pointer-events-auto" aria-hidden="true"></div>
            <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn">
              <div className="relative w-full max-w-md sm:max-w-sm p-4 sm:p-6 md:p-8 rounded-3xl shadow-2xl animate-modalIn bg-white dark:bg-zinc-900 border-2 border-pink-200 dark:border-zinc-700 mx-2"
                style={{ maxHeight: '95vh', overflowY: 'auto' }}
              >
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="absolute top-3 right-3 text-pink-400 dark:text-pink-300 hover:text-pink-600 dark:hover:text-pink-200 text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-pink-400"
                  aria-label="Close"
                >
                  &times;
                </button>
                <h2 className="text-2xl font-extrabold mb-4 text-center text-pink-600 dark:text-pink-200 tracking-tight">Create a Post</h2>
                <form onSubmit={handleCreatePost} className="flex flex-col gap-4">
                {/* Post Type Tabs */}
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    className={`flex-1 py-2 rounded-lg font-semibold text-lg transition border-2 ${form.type === 'general' ? 'bg-pink-100 text-pink-700 border-pink-500 shadow dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700' : 'bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100 dark:bg-zinc-900 dark:text-pink-300 dark:border-zinc-700 dark:hover:bg-pink-900/20'}`}
                    onClick={() => setForm(f => ({ ...f, type: 'general' }))}
                    aria-pressed={form.type === 'general'}
                  >
                    General
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 rounded-lg font-semibold text-lg transition border-2 ${form.type === 'support' ? 'bg-pink-100 text-pink-700 border-pink-500 shadow dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700' : 'bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100 dark:bg-zinc-900 dark:text-pink-300 dark:border-zinc-700 dark:hover:bg-pink-900/20'}`}
                    onClick={() => setForm(f => ({ ...f, type: 'support' }))}
                    aria-pressed={form.type === 'support'}
                  >
                    Support
                  </button>
                </div>
                <div>
                  <label htmlFor="post-title" className="block text-sm font-medium text-pink-700 dark:text-pink-300 mb-1">Title</label>
                  <input
                    id="post-title"
                    name="title"
                    className="w-full border border-pink-200 dark:border-zinc-700 rounded-lg px-4 py-2 bg-pink-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400 transition placeholder-pink-300 dark:placeholder-zinc-500"
                    placeholder="e.g. Need help with school pickup"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="post-content" className="block text-sm font-medium text-pink-700 dark:text-pink-300 mb-1">Content</label>
                  <textarea
                    id="post-content"
                    name="content"
                    className="w-full border border-pink-200 dark:border-zinc-700 rounded-lg px-4 py-2 bg-pink-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400 transition min-h-[80px] placeholder-pink-300 dark:placeholder-zinc-500"
                    placeholder="What's on your mind?"
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label htmlFor="post-visibility" className="block text-sm font-medium text-pink-700 dark:text-pink-300 mb-1">Visibility</label>
                    <select
                      id="post-visibility"
                      name="visibility"
                      value={form.visibility}
                      onChange={e => setForm(f => ({ ...f, visibility: e.target.value as PostVisibility }))}
                      className="w-full rounded-lg border border-pink-200 dark:border-zinc-700 px-4 py-2 bg-pink-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
                    >
                      <option value="public">Public (visible to all)</option>
                      <option value="village">My Village Only</option>
                    </select>
                  </div>
                  <LocationField
                    profileLocation={profile?.city ? `${profile.city}${profile.state ? ', ' + profile.state : ''}` : ''}
                    formLocation={form.location}
                    setForm={setForm}
                  />
                </div>
                {/* Optional photo upload */}
                <div>
                  <label className="block text-sm font-medium text-pink-700 dark:text-pink-300 mb-1">Photo <span className="text-zinc-400 dark:text-zinc-500 font-normal">(optional)</span></label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="post-photo-input"
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      setPhotoFile(file);
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setPhotoPreview(url);
                      } else {
                        setPhotoPreview(null);
                      }
                    }}
                  />
                  {photoPreview ? (
                    <div className="relative mt-1">
                      <img src={photoPreview} alt="Preview" className="w-full rounded-xl object-cover max-h-48 border border-pink-200 dark:border-zinc-700" />
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}
                        className="absolute top-2 right-2 bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 text-pink-600 dark:text-pink-300 rounded-full p-1 text-xs font-bold shadow"
                        aria-label="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="mt-1 w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-pink-200 dark:border-zinc-700 py-3 text-pink-500 dark:text-pink-300 hover:border-pink-400 hover:text-pink-600 dark:hover:text-pink-200 transition text-sm font-medium bg-pink-50 dark:bg-zinc-900"
                    >
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586A2 2 0 0111.414 11H12m0 0l2-2m0 0l2 2m-2-2v6m6-10a2 2 0 00-2-2H6a2 2 0 00-2 2v2" /></svg>
                      Add a photo
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="w-full rounded-lg py-3 text-lg font-bold shadow-md bg-pink-100 text-pink-700 border border-pink-500 hover:bg-pink-200 hover:scale-105 transition-transform disabled:opacity-60 mt-2 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
                  disabled={creating}
                  onClick={handleCreatePost}
                >
                  {creating ? 'Posting...' : 'Post'}
                </button>
                </form>
              </div>
            </div>
          </>
        )}
              {/* Bottom navigation bar with Search, Post, Notifications */}
              <div className={`fixed bottom-6 left-0 w-full flex items-center justify-center z-40 pointer-events-none ${showCreateModal ? 'opacity-60 select-none pointer-events-none' : ''}`}>
                <div className="flex justify-between items-center w-full max-w-xs mx-auto px-4 pointer-events-auto">
                  <NavButton href="/find-moms" icon="search" label="" className="w-14 h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl flex items-center justify-center" />
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-pink-100 hover:bg-pink-200 text-pink-700 rounded-2xl w-20 h-20 flex items-center justify-center shadow-xl border-2 border-pink-500 dark:border-pink-700 dark:bg-pink-900/30 dark:text-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-300 -mt-6 mx-2 dark:hover:bg-pink-900/45"
                    aria-label="Create Post"
                    style={{ zIndex: 2 }}
                    disabled={showCreateModal}
                  >
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="2" d="M12 5v14m7-7H5"/></svg>
                  </button>
                  <NavButton href="/notifications" icon="alarm" label="" className="w-14 h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl flex items-center justify-center" />
                </div>
              </div>
        {/* Feed type toggle */}
        <div className="flex gap-3 mb-4">
          <button onClick={() => { setFeedType('local'); setSelectedGroupId(null); }} className={`px-5 py-2 rounded-full text-base font-semibold border ${feedType === 'local' ? 'bg-pink-100 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700' : 'bg-zinc-200 dark:bg-zinc-800 text-pink-600 dark:text-pink-300 border-transparent'}`}>Local</button>
          <button onClick={() => { setFeedType('village'); setSelectedGroupId(null); }} className={`px-5 py-2 rounded-full text-base font-semibold border ${feedType === 'village' ? 'bg-pink-100 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700' : 'bg-zinc-200 dark:bg-zinc-800 text-pink-600 dark:text-pink-300 border-transparent'}`}>My Village</button>
          <button onClick={() => { setFeedType('groups'); setSelectedGroupId(null); setGroupMode('actions'); }} className={`px-5 py-2 rounded-full text-base font-semibold border ${feedType === 'groups' ? 'bg-pink-100 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700' : 'bg-zinc-200 dark:bg-zinc-800 text-pink-600 dark:text-pink-300 border-transparent'}`}>Groups</button>
        </div>
        {/* Feed logic: Local, Village, Groups */}
        <main className="flex-1 overflow-y-auto">
          {feedType === 'groups' ? (
            selectedGroupId ? (
              (() => {
                const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;
                const isPrivateGroup = selectedGroup?.visibility === "by_permission";
                const isGroupCreator = selectedGroup?.creator_user_id === user?.id;
                const selectedGroupStatus = selectedGroup
                  ? membershipStatusByGroup[selectedGroup.id] || (isGroupCreator ? "approved" : undefined)
                  : undefined;
                const canCreateGroupPosts = !isPrivateGroup || selectedGroupStatus === "approved";
                return (
                  <div>
                    <button
                      className="inline-flex items-center justify-center w-10 h-10 mb-4 bg-white text-pink-500 border border-pink-200 rounded-full shadow hover:bg-pink-50 transition-colors dark:bg-zinc-900 dark:border-zinc-700"
                      onClick={() => { setSelectedGroupId(null); setGroupMode("search"); }}
                      aria-label="Back"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <div className="border rounded-xl p-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <h2 className="text-xl font-bold mb-2 text-zinc-900 dark:text-zinc-50">
                        {selectedGroup?.name || "Group"}
                      </h2>
                      {selectedGroup?.bio && (
                        <div className="text-sm text-zinc-700 dark:text-zinc-200 mb-3 whitespace-pre-line">
                          {selectedGroup.bio}
                        </div>
                      )}
                      {!canCreateGroupPosts ? (
                        <button
                          onClick={() => void handleRequestAccess(selectedGroup.id)}
                          disabled={
                            !!requestingAccessByGroup[selectedGroup.id] ||
                            !!requestedAccessByGroup[selectedGroup.id] ||
                            selectedGroupStatus === "pending" ||
                            selectedGroupStatus === "approved"
                          }
                          className="mt-2 px-4 py-2 rounded-full bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60"
                        >
                          {selectedGroupStatus === "pending"
                            ? "Pending Approval"
                            : requestedAccessByGroup[selectedGroup.id]
                            ? "Request Sent"
                            : requestingAccessByGroup[selectedGroup.id]
                            ? "Sending..."
                            : "Request Access"}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowGroupPostForm((value) => !value)}
                          className="mt-2 px-4 py-2 rounded-full bg-pink-600 text-white hover:bg-pink-700"
                        >
                          {showGroupPostForm ? "Cancel" : "Create Post"}
                        </button>
                      )}

                      {canCreateGroupPosts && showGroupPostForm && (
                        <div className="mt-3 space-y-2">
                          <input
                            type="text"
                            value={groupPostTitle}
                            onChange={(event) => setGroupPostTitle(event.target.value)}
                            placeholder="Post title"
                            className="w-full rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400"
                          />
                          <textarea
                            value={groupPostContent}
                            onChange={(event) => setGroupPostContent(event.target.value)}
                            placeholder="What do you want to share with this group?"
                            rows={4}
                            className="w-full rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400"
                          />
                          <button
                            onClick={() => void handleCreateGroupPost()}
                            disabled={creatingGroupPost}
                            className="px-4 py-2 rounded-full bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60"
                          >
                            {creatingGroupPost ? "Posting..." : "Publish to Group"}
                          </button>
                        </div>
                      )}

                      {(groupPostMessage || groupAccessMessage) && (
                        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{groupPostMessage || groupAccessMessage}</div>
                      )}
                    </div>

                    <div className="mt-4">
                      <h3 className="text-lg font-semibold mb-3 text-zinc-900 dark:text-zinc-50">Posts</h3>
                      {groupPostsLoading ? (
                        <div className="text-sm text-zinc-500">Loading posts...</div>
                      ) : groupPosts.length === 0 ? (
                        <div className="text-sm text-zinc-500">No posts in this group yet.</div>
                      ) : (
                        groupPosts.map((post) => (
                          <div
                            key={post.id}
                            className="border rounded-xl p-4 mb-3 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                          >
                            <div className="font-semibold text-zinc-900 dark:text-zinc-50">{post.title}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                              {post.author_name || "Mom"} • {new Date(post.created_at).toLocaleString()}
                            </div>
                            <PostContentWithPreview
                              text={post.content}
                              className="text-zinc-700 dark:text-zinc-200 whitespace-pre-line"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div>
                <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">Groups</h2>
                {groupMode === "actions" && (
                  <div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        className="w-full rounded-xl p-4 shadow-sm border-2 border-pink-200 bg-pink-50 text-pink-700 dark:bg-pink-950/20 dark:text-pink-200 dark:border-pink-800 hover:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-400 active:border-pink-600 transition"
                        onClick={() => setGroupMode("create")}
                      >
                        <div className="font-semibold text-center">Create Group</div>
                      </button>
                      <button
                        className="w-full rounded-xl p-4 shadow-sm border-2 border-pink-200 bg-pink-50 text-pink-700 dark:bg-pink-950/20 dark:text-pink-200 dark:border-pink-800 hover:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-400 active:border-pink-600 transition"
                        onClick={() => setGroupMode("search")}
                      >
                        <div className="font-semibold text-center">Search Groups</div>
                      </button>
                    </div>

                    <div className="mt-5">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Your Groups</h3>
                      {myGroupsLoading ? (
                        <div className="text-sm text-zinc-500">Loading your groups...</div>
                      ) : myGroups.length === 0 ? (
                        <div className="text-sm text-zinc-500">You haven’t joined any groups yet.</div>
                      ) : (
                        <div className="grid gap-2">
                          {myGroups.map((group) => (
                            <button
                              key={group.id}
                              onClick={() => router.push(`/groups/${group.id}`)}
                              className="w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition"
                            >
                              <div className="font-medium text-zinc-900 dark:text-zinc-50">{group.name}</div>
                              {group.bio && <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5 line-clamp-1">{group.bio}</div>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {groupMode === "create" && (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3">
                    <button
                      className="inline-flex items-center justify-center w-10 h-10 bg-white text-pink-500 border border-pink-200 rounded-full shadow hover:bg-pink-50 transition-colors dark:bg-zinc-900 dark:border-zinc-700"
                      onClick={() => setGroupMode("actions")}
                      aria-label="Back"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(event) => setNewGroupName(event.target.value)}
                      placeholder="Group name"
                      className="w-full rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    />
                    <textarea
                      value={newGroupBio}
                      onChange={(event) => setNewGroupBio(event.target.value)}
                      placeholder="Group bio (what is this group about?)"
                      rows={3}
                      className="w-full rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    />
                    <select
                      value={newGroupVisibility}
                      onChange={(event) => setNewGroupVisibility(event.target.value as "open" | "by_permission")}
                      className="w-full rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    >
                      <option value="open">Open</option>
                      <option value="by_permission">By Permission</option>
                    </select>
                    <button
                      onClick={() => void handleCreateGroup()}
                      disabled={creatingGroup}
                      className="px-4 py-2 rounded-full bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60"
                    >
                      {creatingGroup ? "Creating..." : "Create Group"}
                    </button>
                    {createGroupMessage && (
                      <div className="text-sm text-zinc-600 dark:text-zinc-300">{createGroupMessage}</div>
                    )}
                  </div>
                )}

                {groupMode === "search" && (
                  <div>
                    <button
                      className="inline-flex items-center justify-center w-10 h-10 mb-3 bg-white text-pink-500 border border-pink-200 rounded-full shadow hover:bg-pink-50 transition-colors dark:bg-zinc-900 dark:border-zinc-700"
                      onClick={() => setGroupMode("actions")}
                      aria-label="Back"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <input
                      type="text"
                      value={groupSearch}
                      onChange={(event) => setGroupSearch(event.target.value)}
                      placeholder="Search all groups..."
                      className="w-full mb-4 rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    />
                    {groupsLoading && <div className="text-sm text-zinc-500 mb-3">Searching groups...</div>}
                    {groupsError && !groupsLoading && <div className="text-sm text-zinc-500 mb-3">{groupsError}</div>}
                    <div className="grid gap-3">
                      {groups.map((group) => (
                        <div
                          key={group.id}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm hover:bg-pink-50 dark:hover:bg-pink-900/20 transition"
                        >
                          <button
                            className="w-full text-left"
                            onClick={() => router.push(`/groups/${group.id}`)}
                          >
                            <div className="font-semibold text-zinc-900 dark:text-zinc-50">{group.name}</div>
                          </button>
                          {group.bio && (
                            <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 line-clamp-2">{group.bio}</div>
                          )}
                          {group.visibility === "by_permission" && (
                            <button
                              onClick={() => void handleRequestAccess(group.id)}
                              disabled={
                                !!requestingAccessByGroup[group.id] ||
                                !!requestedAccessByGroup[group.id] ||
                                membershipStatusByGroup[group.id] === "pending" ||
                                membershipStatusByGroup[group.id] === "approved"
                              }
                              className="mt-3 px-3 py-1.5 text-xs rounded-full bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60"
                            >
                              {membershipStatusByGroup[group.id] === "approved"
                                ? "Member"
                                : membershipStatusByGroup[group.id] === "pending"
                                ? "Pending Approval"
                                : requestedAccessByGroup[group.id]
                                ? "Request Sent"
                                : requestingAccessByGroup[group.id]
                                ? "Sending..."
                                : "Request Access"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : loading ? (
            <div className="text-center text-zinc-500 py-8">Loading feed...</div>
          ) : posts.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">No posts yet. Be the first to post!</div>
          ) : (
            <>
              {posts.map(post => (
                <div
                  key={post.id}
                  id={`post-${post.id}`}
                  className={`border rounded-xl p-4 mb-4 shadow-sm ${post.type === 'support' ? 'bg-pink-50 border-pink-300 ring-2 ring-pink-200/70 shadow-[0_6px_18px_rgba(244,114,182,0.22)] dark:bg-pink-950/20 dark:border-pink-700 dark:ring-pink-800/70 dark:shadow-[0_6px_18px_rgba(244,114,182,0.16)]' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
                >
                  {post.type === 'support' && (
                    <div className="-mx-4 -mt-4 mb-3 px-4 py-2 rounded-t-xl bg-pink-600 text-white text-xs font-semibold uppercase tracking-wide">
                      Support Post
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {getProfileHref(post.author_user_id) ? (
                      <div className="flex items-center gap-3 min-w-0 group w-fit max-w-full">
                        <Link href={getProfileHref(post.author_user_id)!} className="shrink-0 block">
                          {authorPhotoById[post.author_user_id] ? (
                            <img
                              src={authorPhotoById[post.author_user_id]}
                              alt={post.author_name || 'Mom'}
                              className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                              {(post.author_name || 'M').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </Link>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 min-w-0 text-sm">
                            <Link href={getProfileHref(post.author_user_id)!} className="font-semibold text-base text-zinc-900 dark:text-zinc-50 truncate group-hover:underline">
                              {post.author_name || 'Mom'}
                            </Link>
                            {post.group_id && (
                              <>
                                <span className="text-pink-600 dark:text-pink-300 shrink-0">posted in</span>
                                <Link href={`/groups/${post.group_id}`} className="text-pink-600 dark:text-pink-300 font-bold hover:text-pink-700 dark:hover:text-pink-200 truncate">
                                  {groupNameById[post.group_id] || 'Group'}
                                </Link>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(post.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 min-w-0">
                        {authorPhotoById[post.author_user_id] ? (
                          <img
                            src={authorPhotoById[post.author_user_id]}
                            alt={post.author_name || 'Mom'}
                            className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                            {(post.author_name || 'M').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 min-w-0 text-sm">
                            <div className="font-semibold text-base text-zinc-900 dark:text-zinc-50 truncate">{post.author_name || 'Mom'}</div>
                            {post.group_id && (
                              <>
                                <span className="text-pink-600 dark:text-pink-300 shrink-0">posted in</span>
                                <Link href={`/groups/${post.group_id}`} className="text-pink-600 dark:text-pink-300 font-bold hover:text-pink-700 dark:hover:text-pink-200 truncate">
                                  {groupNameById[post.group_id] || 'Group'}
                                </Link>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(post.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    )}

                    {user?.id === post.author_user_id && (
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Post actions"
                          onClick={() => setOpenPostMenuId((prev) => (prev === post.id ? null : post.id))}
                          className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center"
                        >
                          ⋯
                        </button>
                        {openPostMenuId === post.id && (
                          <div className="absolute right-0 mt-2 z-20 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleToggleCommentsDisabled(post)}
                              className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            >
                              {post.comments_disabled ? "Enable comments" : "Disable comments"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePost(post.id)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Delete post
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {user?.id !== post.author_user_id && (
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Post actions"
                          onClick={() => setOpenPostMenuId((prev) => (prev === post.id ? null : post.id))}
                          className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center"
                        >
                          ⋯
                        </button>
                        {openPostMenuId === post.id && (
                          <div className="absolute right-0 mt-2 z-20 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => {
                                setReportModalType("post");
                                setReportModalTargetId(post.id);
                                setReportModalOpen(true);
                                setOpenPostMenuId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                            >
                              Report post
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {post.photo_url && (
                    <img
                      src={post.photo_url}
                      alt="Post photo"
                      className="w-full rounded-xl object-cover max-h-72 mb-2 border border-zinc-100 dark:border-zinc-800"
                    />
                  )}
                  <div className="font-bold text-lg mb-1">{post.title}</div>
                  <PostContentWithPreview
                    text={post.content}
                    className="text-zinc-700 dark:text-zinc-200 whitespace-pre-line"
                  />

                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      disabled={!!interactionBusyByPost[post.id]}
                      onClick={() => handleToggleLike(post.id)}
                      className={`px-3 py-1 rounded-full border transition ${likedByMeByPost[post.id] ? 'bg-pink-100 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700' : 'bg-white text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700'}`}
                    >
                      {likedByMeByPost[post.id] ? '♥' : '♡'} Like {likesCountByPost[post.id] || 0}
                    </button>
                    {post.visibility === 'public' && (
                      <button
                        type="button"
                        disabled={!!interactionBusyByPost[post.id]}
                        onClick={() => handleShare(post)}
                        className="px-3 py-1 rounded-full border bg-white text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700"
                      >
                        ↗ Share {sharesCountByPost[post.id] || 0}
                      </button>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {post.comments_disabled ? null : (
                      <>
                        {(() => {
                          const allComments = commentsByPost[post.id] || [];
                          const isExpanded = !!expandedCommentsByPost[post.id];
                          const visibleComments = isExpanded ? allComments : allComments.slice(0, 2);
                          const hiddenCount = Math.max(0, allComments.length - visibleComments.length);

                          return (
                            <>
                              {visibleComments.map((comment) => {
                                const isEditing = editingCommentId === comment.id;
                                const displayName = authorNameById[comment.author_user_id] || (comment.author_user_id === user?.id ? (profile?.full_name || 'You') : 'Mom');
                                const commentProfileHref = getProfileHref(comment.author_user_id);

                                return (
                                  <div key={comment.id} className="flex gap-3 text-sm bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 py-3 border border-zinc-200 dark:border-zinc-700">
                                    <div className="shrink-0">
                                      {commentProfileHref ? (
                                        <Link href={commentProfileHref} className="block">
                                          {authorPhotoById[comment.author_user_id] ? (
                                            <img
                                              src={authorPhotoById[comment.author_user_id]}
                                              alt={displayName}
                                              className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                                            />
                                          ) : (
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                                              {displayName.charAt(0).toUpperCase()}
                                            </div>
                                          )}
                                        </Link>
                                      ) : (
                                        authorPhotoById[comment.author_user_id] ? (
                                          <img
                                            src={authorPhotoById[comment.author_user_id]}
                                            alt={displayName}
                                            className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                                          />
                                        ) : (
                                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                                            {displayName.charAt(0).toUpperCase()}
                                          </div>
                                        )
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-3">
                                        {commentProfileHref ? (
                                          <Link href={commentProfileHref} className="font-semibold text-zinc-800 dark:text-zinc-100 truncate hover:underline">
                                            {displayName}
                                          </Link>
                                        ) : (
                                          <span className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                                            {displayName}
                                          </span>
                                        )}
                                        <div className="relative shrink-0">
                                          <button
                                            type="button"
                                            aria-label="Comment actions"
                                            onClick={() => setOpenCommentMenuId((prev) => (prev === comment.id ? null : comment.id))}
                                            className="w-7 h-7 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center"
                                          >
                                            ⋯
                                          </button>
                                          {openCommentMenuId === comment.id && (
                                            <div className="absolute right-0 mt-2 z-30 w-36 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                                              {comment.author_user_id === user?.id && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleStartEditComment(comment)}
                                                  className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                >
                                                  Edit
                                                </button>
                                              )}
                                              {(user?.id === comment.author_user_id || user?.id === post.author_user_id) && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteComment(post, comment)}
                                                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                  Delete
                                                </button>
                                              )}
                                              {comment.author_user_id !== user?.id && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setReportModalType("comment");
                                                    setReportModalTargetId(comment.id);
                                                    setReportModalOpen(true);
                                                    setOpenCommentMenuId(null);
                                                  }}
                                                  className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                                >
                                                  Report
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {isEditing ? (
                                        <div className="mt-2 space-y-2">
                                          <textarea
                                            value={editingCommentDraft}
                                            onChange={(e) => setEditingCommentDraft(e.target.value)}
                                            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm min-h-[84px]"
                                          />
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => handleSaveCommentEdit(post, comment)}
                                              disabled={!!interactionBusyByPost[post.id]}
                                              className="px-3 py-2 rounded-lg bg-pink-100 text-pink-700 border border-pink-500 text-sm font-semibold hover:bg-pink-200 disabled:opacity-60 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
                                            >
                                              Save
                                            </button>
                                            <button
                                              type="button"
                                              onClick={handleCancelEditComment}
                                              disabled={!!interactionBusyByPost[post.id]}
                                              className="px-3 py-2 rounded-lg border bg-white text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-zinc-700 dark:text-zinc-200 mt-1 whitespace-pre-line">
                                          {comment.body}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {hiddenCount > 0 && !isExpanded && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedCommentsByPost((prev) => ({ ...prev, [post.id]: true }))}
                                  className="text-sm font-semibold text-pink-600 hover:text-pink-700 px-1"
                                >
                                  {hiddenCount} more comments
                                </button>
                              )}

                              {isExpanded && allComments.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedCommentsByPost((prev) => ({ ...prev, [post.id]: false }))}
                                  className="text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 px-1"
                                >
                                  Show fewer comments
                                </button>
                              )}
                            </>
                          );
                        })()}
                        <form
                          className="flex items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleAddComment(post.id);
                          }}
                        >
                          <input
                            type="text"
                            value={commentDraftByPost[post.id] || ''}
                            onChange={(e) => setCommentDraftByPost((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Write a comment..."
                            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm"
                          />
                          <button
                            type="submit"
                            disabled={!!interactionBusyByPost[post.id] || !(commentDraftByPost[post.id] || '').trim()}
                            className="px-3 py-2 rounded-lg bg-pink-100 text-pink-700 border border-pink-500 text-sm font-semibold hover:bg-pink-200 disabled:opacity-60 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
                          >
                            Comment
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </main>
        <ReportModal
          isOpen={reportModalOpen}
          reportType={reportModalType}
          targetId={reportModalTargetId}
          onClose={() => setReportModalOpen(false)}
          onSubmit={handleReport}
        />
      </div>
    </div>
  );

//

// Ensure handleCreatePost is defined as:
// async function handleCreatePost() {
//   setCreating(true);
//   try {
//     await createPost({
//       ...form,
//       author_id: user.id,
//       author_name: profile?.full_name || 'Anonymous',
//       type: 'general', // default type
//       scope: form.visibility === 'village' ? 'village' : 'local', // derive scope from visibility
//     });
//     setForm({
//       title: '',
//       content: '',
//       visibility: 'public',
//       location: profile?.city ? `${profile.city}${profile.state ? ', ' + profile.state : ''}` : '',
//     });
//     await loadPosts();
//   } catch (e) {
//     alert('Failed to create post');
//   } finally {
//     setCreating(false);
//   }
// }

// Remove stray button/svg JSX outside of any component.

// ...existing code...
}

function NavButton({ href, icon, label, className = "" }: { href: string; icon: 'user' | 'chat' | 'search' | 'plus' | 'alarm'; label?: string; className?: string }) {
  const isIconOnly = !label;
  // Highlight if the button's href matches the current path (for main nav pages)
  const pathname = usePathname ? usePathname() : undefined;
  const isActive = pathname && (pathname === href || (href === "/find-moms" && pathname.startsWith("/find-moms")) || (href === "/messages" && pathname.startsWith("/messages")) || (href === "/notifications" && pathname.startsWith("/notifications")));
  // Add pink highlight if active
  const activeClass = isActive ? "bg-pink-100 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700" : "";
  const iconMap: Record<string, JSX.Element> = {
    user: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7"><circle cx="12" cy="8" r="4" strokeWidth="1.5"/><path strokeWidth="1.5" d="M4 20c0-2.5 3.5-4 8-4s8 1.5 8 4"/></svg>
    ),
    chat: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7"><path strokeWidth="1.5" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    ),
    search: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7"><circle cx="11" cy="11" r="7" strokeWidth="1.5"/><path strokeWidth="1.5" d="M21 21l-4.35-4.35"/></svg>
    ),
    plus: (
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8"><path strokeWidth="2" d="M12 5v14m7-7H5"/></svg>
    ),
    alarm: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7">
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Z" />
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 17h16" />
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  };
  return (
    <Link
      href={href}
      className={`flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl w-12 h-12 hover:bg-pink-50 dark:hover:bg-pink-900/30 transition-all focus:outline-none focus:ring-2 focus:ring-pink-400 active:scale-95 active:ring-4 active:ring-pink-300 ${activeClass} ${className}`}
      aria-label={label || icon}
    >
      {iconMap[icon]}
      {!isIconOnly && label}
    </Link>
  );
}
