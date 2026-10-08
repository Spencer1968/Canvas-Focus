import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAssignments } from './src/services/api';

const ICS_STORAGE_KEY = '@canvas_ics_url';

export default function App() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userOffsets, setUserOffsets] = useState({});

    // Calendar Feed State
    const [icsUrl, setIcsUrl] = useState('');
    const [inputUrl, setInputUrl] = useState('');
    const [isConfigured, setIsConfigured] = useState(false);
    const [showSetupModal, setShowSetupModal] = useState(false);

    // Toggle this in UI to switch between Free and Pro preview modes
    const [isPremium, setIsPremium] = useState(false);

    // Modal & Selection state
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [subTasks, setSubTasks] = useState({});

    // Handler to adjust priority offset
    const adjustPriority = (assignmentId, amount) => {
        setUserOffsets((prev) => {
            const currentOffset = prev[assignmentId] || 0;
            return {
                ...prev,
                [assignmentId]: currentOffset + amount,
            };
        });
    };

    // Calculate final score including user offset
    const getAdjustedScore = (item) => {
        const baseScore = item.priority_score || 0;
        const offset = userOffsets[item.id] || 0;
        return Math.max(0, baseScore + offset);
    };

    // Generates dynamic daily action steps based on remaining days until due date
    const generateActionPlan = (dueAtString) => {
        if (!dueAtString) {
            return [
                { id: 1, title: 'Day 1: Review assignment prompt & rubric', completed: false },
                { id: 2, title: 'Day 2: Complete submission and verify upload', completed: false },
            ];
        }

        const due = new Date(dueAtString);
        const now = new Date();
        const diffTime = due - now;
        const daysLeft = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        if (daysLeft <= 1) {
            return [
                { id: 1, title: 'Urgent: Read requirements & draft core solution', completed: false },
                { id: 2, title: 'Urgent: Run final tests & submit before deadline', completed: false },
            ];
        } else if (daysLeft <= 3) {
            return [
                { id: 1, title: 'Day 1: Break down requirements & gather resources', completed: false },
                { id: 2, title: 'Day 2: Build main logic / complete draft', completed: false },
                { id: 3, title: 'Day 3: Review, test, and submit', completed: false },
            ];
        } else {
            return [
                { id: 1, title: 'Day 1-2: Read prompt, review rubric & plan structure', completed: false },
                { id: 2, title: 'Day 3-4: Work on implementation / main body', completed: false },
                { id: 3, title: 'Day 5+: Self-review, refactor, and submit early', completed: false },
            ];
        }
    };

    const saveIcsUrl = async () => {
        try {
            const trimmedUrl = inputUrl.trim();
            if (trimmedUrl) {
                await AsyncStorage.setItem(ICS_STORAGE_KEY, trimmedUrl);
                setIcsUrl(trimmedUrl);
                setIsConfigured(true);
            } else {
                await AsyncStorage.removeItem(ICS_STORAGE_KEY);
                setIcsUrl('');
                setIsConfigured(false);
            }
            setShowSetupModal(false);

            // Fetch assignments immediately with the new URL
            setLoading(true);
            const data = await fetchAssignments(null, trimmedUrl);
            const sortedAssignments = [...data].sort(
                (a, b) => (b.priority_score || 0) - (a.priority_score || 0)
            );
            setAssignments(sortedAssignments);

            // Pre-fill action plans
            const initialTasks = {};
            sortedAssignments.forEach((item) => {
                initialTasks[item.id] = generateActionPlan(item.due_at);
            });
            setSubTasks(initialTasks);
            setError(null);
        } catch (err) {
            console.error('Failed to save ICS URL:', err);
            setError('Failed to load feed with provided URL.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout limit

        const checkStorageAndLoad = async () => {
            try {
                // 1. Read saved .ics URL from AsyncStorage
                const savedUrl = await AsyncStorage.getItem(ICS_STORAGE_KEY);
                if (!savedUrl) {
                    setIsConfigured(false);
                    setLoading(false);
                    return
                }

                setIsConfigured(true);
                const data = await fetchAssignments(controller.signal, savedUrl);

                // Sort assignments by priority_score descending (highest to lowest)
                const sortedAssignments = [...data].sort(
                    (a, b) => (b.priority_score || 0) - (a.priority_score || 0)
                );
                setAssignments(sortedAssignments);

                // Pre-fill mock daily sub-tasks for testing
                const initialTasks = {};
                sortedAssignments.forEach((item) => {
                    initialTasks[item.id] = generateActionPlan(item.due_at);
                });
                setSubTasks(initialTasks);
                setError(null);
            } catch (err) {
                console.error('Fetch error:', err);
                setError(err.message || 'Failed to connect to backend server');
            } finally {
                setLoading(false);
                clearTimeout(timeoutId);
            }
        };

        checkStorageAndLoad();

        return () => {
            controller.abort();
            clearTimeout(timeoutId);
        };
    }, []);

    // Format date strings
    const formatDate = (dateString) => {
        if (!dateString) return 'No due date';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // Strip raw HTML tags sent from Canvas API
    const cleanDescription = (html) => {
        if (!html) return '';
        return html
            .replace(/<[^>]*>?/gm, '')
            .replace(/&nbsp;/g, ' ')
            .trim();
    };

    const getPriorityStyle = (score) => {
        if (score >= 100) {
            return {
                badge: { backgroundColor: '#fee2e2' },
                text: { color: '#dc2626' },
            };
        } else if (score >= 70) {
            return {
                badge: { backgroundColor: '#ffedd5' },
                text: { color: '#ea580c' },
            };
        }
        return {
            badge: { backgroundColor: '#eef2ff' },
            text: { color: '#4f46e5' },
        };
    };

    // Toggle sub-task completed status
    const toggleSubTask = (assignmentId, taskId) => {
        setSubTasks((prev) => ({
            ...prev,
            [assignmentId]: prev[assignmentId].map((task) =>
                task.id === taskId ? { ...task, completed: !task.completed } : task
            ),
        }));
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.subtext}>Connecting to backend...</Text>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Connection Error:</Text>
                <Text style={styles.subtext}>{error}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header with Quick Tier Mode Toggle */}
            <View style={styles.headerContainer}>
                <Text style={styles.header}>Canvas Focus</Text>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.settingsButton}
                        onPress={() => setShowSetupModal(true)}
                    >
                        <Text style={styles.settingsButtonText}>ICS Settings</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tierBadge, isPremium ? styles.tierPro : styles.tierFree]}
                        onPress={() => setIsPremium(!isPremium)}
                    >
                        <Text style={styles.tierText}>
                            {isPremium ? 'PRO MODE' : 'FREE MODE'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Main Assignment List */}
            <FlatList
                data={[...assignments].sort((a, b) => {
                    if (!a.due_at) return 1;
                    if (!b.due_at) return -1;
                    return new Date(a.due_at) - new Date(b.due_at);
                })}
                keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                renderItem={({ item }) => {
                    const adjustedScore = getAdjustedScore(item);
                    const priorityStyle = getPriorityStyle(adjustedScore);

                    return (
                        <TouchableOpacity
                            style={styles.card}
                            activeOpacity={0.7}
                            onPress={() => setSelectedAssignment(item)}
                        >
                            <View style={styles.cardHeader}>
                                <Text style={styles.title}>{item.name}</Text>
                                {item.priority_score !== undefined && (
                                    <View style={[styles.priorityBadge, priorityStyle.badge]}>
                                        <Text style={[styles.priorityLabel, priorityStyle.text]}>
                                            Priority
                                        </Text>
                                        <Text style={[styles.priorityValue, priorityStyle.text]}>
                                            {Math.round(adjustedScore)}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.cardFooter}>
                                <Text style={styles.dueDate}>Due: {formatDate(item.due_at)}</Text>
                                {item.points_possible !== null && item.points_possible !== undefined && (
                                    <Text style={styles.points}>Points: {item.points_possible}</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <Text style={styles.subtext}>No assignments found.</Text>
                }
            />

            {/* ICS Feed Settings Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showSetupModal}
                onRequestClose={() => setShowSetupModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalScrollView}>
                            <Text style={styles.modalTitle}>Canvas Feed Settings</Text>
                            <Text style={styles.modalSubtext}>
                                Paste or update your Canvas .ics calendar feed URL below:
                            </Text>

                            <TextInput
                                style={styles.input}
                                placeholder="https://canvas.instructure.com/feeds/..."
                                placeholderTextColor="#94a3b8"
                                value={inputUrl}
                                onChangeText={setInputUrl}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />

                            <TouchableOpacity style={styles.primaryButton} onPress={saveIcsUrl}>
                                <Text style={styles.primaryButtonText}>Save & Reload</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowSetupModal(false)}
                            >
                                <Text style={styles.closeButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Popup Modal Detail View */}
            {selectedAssignment && (
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={!!selectedAssignment}
                    onRequestClose={() => setSelectedAssignment(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <ScrollView
                                style={styles.modalScrollView}
                                contentContainerStyle={styles.modalScrollContent}
                                showsVerticalScrollIndicator={true}
                            >
                                <Text style={styles.modalTitle}>{selectedAssignment.name}</Text>
                                <Text style={styles.modalSubtext}>
                                    Due: {formatDate(selectedAssignment.due_at)}
                                    {selectedAssignment.points_possible !== null && selectedAssignment.points_possible !== undefined
                                        ? ` | Points: ${selectedAssignment.points_possible}`
                                        : ''}
                                    {` | Priority: 🔥 ${Math.round(getAdjustedScore(selectedAssignment))}`}
                                </Text>

                                {/* Priority Tuning Controls */}
                                <View style={styles.tuningContainer}>
                                    <Text style={styles.sectionHeader}>Adjust Priority Score</Text>
                                    <View style={styles.tuningButtonsRow}>
                                        <TouchableOpacity
                                            style={[styles.tuneButton, styles.tuneDown]}
                                            onPress={() => adjustPriority(selectedAssignment.id, -5)}
                                        >
                                            <Text style={styles.tuneButtonText}>-5 Lower</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.currentOffsetText}>
                                            Offset: {userOffsets[selectedAssignment.id] > 0 ? `+${userOffsets[selectedAssignment.id]}` : userOffsets[selectedAssignment.id] || 0}
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.tuneButton, styles.tuneUp]}
                                            onPress={() => adjustPriority(selectedAssignment.id, 10)}
                                        >
                                            <Text style={styles.tuneButtonText}>+10 Boost 🔥</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Assignment Description */}
                                {selectedAssignment.description ? (
                                    <View style={styles.descriptionBox}>
                                        <Text style={styles.descriptionHeader}>Assignment Overview</Text>
                                        <Text style={styles.descriptionText}>
                                            {cleanDescription(selectedAssignment.description)}
                                        </Text>
                                    </View>
                                ) : null}

                                {/* Action Plan Section */}
                                <Text style={styles.sectionHeader}>Daily Action Plan</Text>

                                {isPremium ? (
                                    /* Pro Tier Checklist */
                                    <View style={styles.checklistContainer}>
                                        {(subTasks[selectedAssignment.id] || generateActionPlan(selectedAssignment)).map((task) => (
                                            <TouchableOpacity
                                                key={task.id}
                                                style={styles.checkItem}
                                                onPress={() => toggleSubTask(selectedAssignment.id, task.id)}
                                            >
                                                <View
                                                    style={[
                                                        styles.checkbox,
                                                        task.completed && styles.checkboxChecked,
                                                    ]}
                                                >
                                                    {task.completed && <Text style={styles.checkmark}>✓</Text>}
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.taskText,
                                                        task.completed && styles.taskTextCompleted,
                                                    ]}
                                                >
                                                    {task.title}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : (
                                    /* Free Tier Upsell Banner */
                                    <View style={styles.upsellCard}>
                                        <Text style={styles.upsellTitle}>🔒 Daily Action Plan Locked</Text>
                                        <Text style={styles.upsellDescription}>
                                            Upgrade to Pro to automatically break down assignments into actionable daily steps!
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.upgradeButton}
                                            onPress={() => setIsPremium(true)}
                                        >
                                            <Text style={styles.upgradeButtonText}>Simulate Upgrade to Pro</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={() => setSelectedAssignment(null)}
                                >
                                    <Text style={styles.closeButtonText}>Close</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    settingsButton: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    settingsButtonText: {
        color: '#475569',
        fontSize: 10,
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1e293b',
        marginBottom: 16,
    },
    primaryButton: {
        backgroundColor: '#4f46e5',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    tierBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    tierPro: {
        backgroundColor: '#4f46e5',
    },
    tierFree: {
        backgroundColor: '#6b7280',
    },
    tierText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    subtext: {
        marginTop: 10,
        textAlign: 'center',
        color: '#666',
    },
    errorText: {
        color: '#d9534f',
        fontWeight: 'bold',
        fontSize: 18,
        textAlign: 'center',
    },

    // Main Card Styles
    card: {
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2c3e50',
        flex: 1,
        marginRight: 8,
    },
    priorityBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignItems: 'center',
        minWidth: 50,
    },
    priorityLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    priorityValue: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 8,
    },
    dueDate: {
        fontSize: 13,
        color: '#e67e22',
        fontWeight: '600',
    },
    points: {
        fontSize: 13,
        color: '#7f8c8d',
        fontWeight: '500',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
        paddingTop: 16,
    },
    modalScrollView: {
        paddingHorizontal: 24,
    },
    modalScrollContent: {
        paddingBottom: 30,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    modalSubtext: {
        fontSize: 13,
        color: '#666',
        marginTop: 4,
        marginBottom: 16,
    },
    descriptionBox: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    descriptionHeader: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    descriptionText: {
        fontSize: 13,
        color: '#334155',
        lineHeight: 18,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 10,
    },

    // Checklist Styles
    checklistContainer: {
        marginBottom: 20,
    },
    checkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#4f46e5',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#4f46e5',
    },
    checkmark: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
    },
    taskText: {
        fontSize: 14,
        color: '#334155',
    },
    taskTextCompleted: {
        textDecorationLine: 'line-through',
        color: '#94a3b8',
    },

    // Free Tier Upsell Banner
    upsellCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
    },
    upsellTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 6,
    },
    upsellDescription: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 14,
    },
    upgradeButton: {
        backgroundColor: '#4f46e5',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    upgradeButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 12,
    },

    closeButton: {
        backgroundColor: '#f1f5f9',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#475569',
        fontWeight: '700',
    },
    tuningContainer: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    tuningButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    tuneButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
    },
    tuneUp: {
        backgroundColor: '#ea580c',
    },
    tuneDown: {
        backgroundColor: '#94a3b8',
    },
    tuneButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    currentOffsetText: {
        fontWeight: 'bold',
        color: '#334155',
        fontSize: 14,
    },
});